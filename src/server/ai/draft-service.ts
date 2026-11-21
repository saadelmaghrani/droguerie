// Brouillon IA d'un NOUVEAU produit (page « Nouveau produit », bouton « Générer avec l'IA »).
// Sans authentification : appelé par draft-actions.ts, qui vérifie l'admin AVANT.
//
// 1. createProductDraft : la photo envoyée est enregistrée, puis EN PARALLÈLE :
//      - détourage local UNE fois → photo principale fond blanc + 2 montages (studio, table),
//        produit intact au pixel près, gratuit ;
//      - nom + description (petit modèle OpenAI « vision », ≈ 0,001 $) ;
//      - en option (case cochée) : 2 mises en scène redessinées par OpenAI (≈ 0,05 $ chacune).
//    Chaque partie peut échouer seule : les autres restent utilisables.
//    Plafond mensuel du site vérifié AVANT tout appel payant (budget.ts).
// 2. attachDraftToProduct : après « Créer le produit », SEULES les photos choisies par l'admin
//    sont rattachées ; les autres fichiers sont supprimés.
// 3. Brouillon abandonné (page fermée) : tout est supprimé après 24 h.
import "server-only";

import { prisma } from "@/lib/prisma";
import { deleteImageFiles, processImage, type ProcessedImage } from "@/server/media/images";
import { localStorage } from "@/server/media/storage";
import type { AiGenerationType } from "@/generated/prisma/client";
import type { ExtraCount, ExtraKind } from "@/lib/ai-costs";
import { ACCOUNT_ACTION_KINDS, AiError, classifyOpenAiError } from "./errors";
import { generateProductText } from "./product-text";
import { estimateCostUsd, type ProductTextHints } from "./product-text-prompt";
import { budgetError, ESTIMATED_COST_USD } from "./budget";
import { estimateImageCostUsd, sceneFromOpenAi } from "./scenes-openai";
import { composeMontage, composeWhite, cutoutProduct, MONTAGE_LABELS, type CutoutProduct, type MontageStyle } from "./studio-cutout";

export type DraftImage = { key: string; width: number; height: number };
export type DraftPart<T> = { ok: true; value: T } | { ok: false; message: string; accountAction: boolean };
export type DraftText = { name: string; description: string };
/** Photos supplémentaires proposées : montages locaux (fidèles) puis, en option, mises en scène IA. */
export const EXTRA_SLOTS = ["montage-studio", "montage-table", "ai-0", "ai-1"] as const;
export type ExtraSlot = (typeof EXTRA_SLOTS)[number];
export type DraftExtra = { slot: ExtraSlot; kind: "montage" | "ai"; label: string; part: DraftPart<DraftImage> };
export type DraftResult =
  | {
      ok: true;
      draftId: string;
      original: DraftImage;
      studio: DraftPart<DraftImage>;
      extras: DraftExtra[];
      text: DraftPart<DraftText>;
    }
  | { ok: false; message: string };

/** 3 photos maximum par produit : la principale + 2 supplémentaires. */
export const MAX_EXTRAS = 2;
export type DraftChoice = { main: "studio" | "original"; keep: ExtraSlot[] };

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const MONTAGES: { slot: ExtraSlot; style: MontageStyle }[] = [
  { slot: "montage-studio", style: "studio" },
  { slot: "montage-table", style: "table" },
];

type PartOutcome = { value: unknown; output: object; model: string; inputTokens?: number; outputTokens?: number; costUsd: number };

/** Exécute une partie, l'enregistre dans ai_generations (PENDING ou FAILED) et la traduit pour l'interface. */
async function runPart<T>(
  ctx: { draftId: string; adminUserId: string; inputImageKey: string },
  type: AiGenerationType,
  provider: "local" | "openai",
  fallbackModel: string,
  task: () => Promise<PartOutcome & { value: T }>,
): Promise<DraftPart<T>> {
  const started = Date.now();
  try {
    const result = await task();
    await prisma.aiGeneration.create({
      data: {
        type,
        status: "PENDING",
        draftId: ctx.draftId,
        adminUserId: ctx.adminUserId,
        inputImageKey: ctx.inputImageKey,
        output: result.output,
        provider,
        model: result.model,
        inputTokens: result.inputTokens ?? null,
        outputTokens: result.outputTokens ?? null,
        imagesCount: type === "TEXT" ? 0 : 1,
        estimatedCostUsd: result.costUsd,
        durationMs: Date.now() - started,
      },
    });
    return { ok: true, value: result.value };
  } catch (error) {
    const aiError = classifyOpenAiError(error);
    if (aiError.kind !== "not_configured") {
      console.error(`[IA] Brouillon ${ctx.draftId} (${type}) : ${aiError.kind} ${aiError.detail ?? ""}`);
      await prisma.aiGeneration.create({
        data: {
          type,
          status: "FAILED",
          draftId: ctx.draftId,
          adminUserId: ctx.adminUserId,
          inputImageKey: ctx.inputImageKey,
          provider,
          model: fallbackModel,
          durationMs: Date.now() - started,
          errorMessage: `${aiError.kind}: ${aiError.detail ?? ""}`.slice(0, 500),
        },
      });
    }
    return { ok: false, message: aiError.message, accountAction: ACCOUNT_ACTION_KINDS.includes(aiError.kind) };
  }
}

async function storePng(png: Buffer, draftId: string, name: string): Promise<ProcessedImage> {
  const processed = await processImage(new File([new Uint8Array(png)], name, { type: "image/png" }), "product", draftId);
  if (!processed.ok) throw new AiError("bad_response", processed.error);
  return processed.image;
}

const toDraftImage = (i: ProcessedImage): DraftImage => ({ key: i.key, width: i.width, height: i.height });

export async function createProductDraft(
  file: File,
  hints: ProductTextHints,
  adminUserId: string,
  /** extraCount : 0 à 2 photos supplémentaires ; extraKind : montages locaux (gratuits) ou mises en scène IA. */
  options: { extraCount: ExtraCount; extraKind: ExtraKind },
): Promise<DraftResult> {
  await cleanupStaleDrafts();
  const draftId = crypto.randomUUID();
  const uploaded = await processImage(file, "product", draftId);
  if (!uploaded.ok) return { ok: false, message: uploaded.error };
  const original = toDraftImage(uploaded.image);
  await prisma.productDraft.create({
    data: { id: draftId, originalKey: original.key, originalWidth: original.width, originalHeight: original.height, adminUserId },
  });

  const [full, medium] = await Promise.all([
    localStorage.read(`${original.key}-orig.webp`),
    localStorage.read(`${original.key}-800.webp`),
  ]);
  if (!full || !medium) return { ok: false, message: "Photo introuvable après l'envoi. Réessayez." };
  const ctx = { draftId, adminUserId, inputImageKey: original.key };

  // Plafond du site : vérifié une fois pour toutes les parties payantes demandées.
  const aiSceneCount = options.extraKind === "ai" ? options.extraCount : 0;
  const montageCount = options.extraKind === "montage" ? options.extraCount : 0;
  const overBudget = await budgetError(ESTIMATED_COST_USD.text + aiSceneCount * ESTIMATED_COST_USD.scene);
  const guard = () => {
    if (overBudget) throw overBudget;
  };

  // Détourage UNE fois, réutilisé pour la photo principale et les montages.
  const cutout: Promise<CutoutProduct> = cutoutProduct(full);
  cutout.catch(() => {}); // l'erreur est traitée par chaque partie qui l'attend

  const studio = runPart<DraftImage>(ctx, "IMAGE_STUDIO", "local", "isnet-general-use", async () => {
    const image = toDraftImage(await storePng(await composeWhite(await cutout), draftId, "studio.png"));
    return { value: image, output: { ...image, role: "studio" }, model: "isnet-general-use", costUsd: 0 };
  });
  const montages = MONTAGES.slice(0, montageCount).map(({ slot, style }) =>
    runPart<DraftImage>(ctx, "IMAGE_STUDIO", "local", "isnet-general-use", async () => {
      const image = toDraftImage(await storePng(await composeMontage(await cutout, style), draftId, `${slot}.png`));
      return { value: image, output: { ...image, role: "extra", slot }, model: "isnet-general-use", costUsd: 0 };
    }).then((part): DraftExtra => ({ slot, kind: "montage", label: MONTAGE_LABELS[style], part })),
  );
  const aiScenes = aiSceneCount > 0
    ? ([0, 1] as const).slice(0, aiSceneCount).map((index) => {
        const slot: ExtraSlot = index === 0 ? "ai-0" : "ai-1";
        return runPart<DraftImage>(ctx, "IMAGE_SCENE", "openai", "", async () => {
          guard();
          const result = await sceneFromOpenAi(full, index);
          const image = toDraftImage(await storePng(result.png, draftId, `${slot}.png`));
          return {
            value: image,
            output: { ...image, role: "extra", slot },
            model: result.model,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            costUsd: estimateImageCostUsd(result.model, result.inputTokens, result.outputTokens),
          };
        }).then((part): DraftExtra => ({ slot, kind: "ai", label: `Mise en scène IA ${index + 1}`, part }));
      })
    : [];
  const text = runPart<DraftText>(ctx, "TEXT", "openai", "", async () => {
    guard();
    const result = await generateProductText(medium, hints);
    return {
      value: result.suggestion,
      output: result.suggestion,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: estimateCostUsd(result.model, result.inputTokens, result.outputTokens),
    };
  });

  const [studioResult, textResult, extras] = await Promise.all([studio, text, Promise.all([...montages, ...aiScenes])]);
  return { ok: true, draftId, original, studio: studioResult, extras, text: textResult };
}

type ImageOutput = DraftImage & { role: "studio" | "extra"; slot?: ExtraSlot };

/** Rattache les photos CHOISIES au produit créé ; supprime les fichiers non retenus. */
export async function attachDraftToProduct(productId: string, draftId: string, choice: DraftChoice): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const draft = await prisma.productDraft.findUnique({ where: { id: draftId } });
  if (!draft || draft.consumedAt) return { ok: false, message: "Les photos générées ont expiré : ajoutez-les depuis la fiche." };
  const generations = await prisma.aiGeneration.findMany({ where: { draftId, status: "PENDING" } });
  const outputOf = (g: (typeof generations)[number]) => g.output as unknown as ImageOutput;
  const studioGen = generations.find((g) => g.type === "IMAGE_STUDIO" && outputOf(g).role === "studio");
  const extraGens = generations.filter((g) => g.type !== "TEXT" && outputOf(g).role === "extra");

  const useStudio = choice.main === "studio" && studioGen !== undefined;
  // Ordre d'affichage : celui des emplacements proposés ; 2 au maximum (3 photos par produit).
  const keptExtras = EXTRA_SLOTS.filter((slot) => choice.keep.includes(slot))
    .map((slot) => extraGens.find((g) => outputOf(g).slot === slot))
    .filter((g): g is (typeof generations)[number] => g !== undefined)
    .slice(0, MAX_EXTRAS);
  const unused = [
    ...(studioGen && !useStudio ? [outputOf(studioGen).key] : []),
    ...extraGens.filter((g) => !keptExtras.includes(g)).map((g) => outputOf(g).key),
  ];

  const result = await prisma.$transaction(async (tx) => {
    if ((await tx.productImage.count({ where: { productId } })) > 0) return null; // produit déjà illustré
    const main = useStudio
      ? { storageKey: outputOf(studioGen!).key, width: outputOf(studioGen!).width, height: outputOf(studioGen!).height, source: "AI_STUDIO" as const, originalStorageKey: draft.originalKey }
      : { storageKey: draft.originalKey, width: draft.originalWidth, height: draft.originalHeight, source: "ORIGINAL" as const, originalStorageKey: null };
    const rows = [
      main,
      ...keptExtras.map((g) => ({
        storageKey: outputOf(g).key,
        width: outputOf(g).width,
        height: outputOf(g).height,
        // Montage local : produit d'origine posé sur un décor. Mise en scène IA : image redessinée.
        source: g.type === "IMAGE_SCENE" ? ("AI_GENERATED" as const) : ("AI_STUDIO" as const),
        originalStorageKey: null,
      })),
    ];
    await tx.productImage.createMany({ data: rows.map((r, position) => ({ ...r, productId, position })) });
    const accepted = new Set([...(useStudio ? [studioGen!.id] : []), ...keptExtras.map((g) => g.id), ...generations.filter((g) => g.type === "TEXT").map((g) => g.id)]);
    for (const g of generations) {
      await tx.aiGeneration.update({ where: { id: g.id }, data: { productId, status: accepted.has(g.id) ? "ACCEPTED" : "REJECTED", decidedAt: new Date() } });
    }
    await tx.aiGeneration.updateMany({ where: { draftId, status: "FAILED" }, data: { productId } });
    await tx.productDraft.update({ where: { id: draftId }, data: { consumedAt: new Date() } });
    return rows.length;
  });
  if (result === null) return { ok: false, message: "Ce produit a déjà des photos : les photos générées n'ont pas été ajoutées." };
  await Promise.all(unused.map((key) => deleteImageFiles(key, "product")));
  return { ok: true, count: result };
}

/** Abandon (nouvelle photo, page quittée) : fichiers supprimés, propositions refusées. */
export async function discardDraft(draftId: string): Promise<void> {
  const draft = await prisma.productDraft.findUnique({ where: { id: draftId } });
  if (!draft || draft.consumedAt) return;
  const generations = await prisma.aiGeneration.findMany({ where: { draftId, status: "PENDING", type: { not: "TEXT" } } });
  await Promise.all([
    deleteImageFiles(draft.originalKey, "product"),
    ...generations.map((g) => deleteImageFiles((g.output as unknown as ImageOutput).key, "product")),
  ]);
  await prisma.aiGeneration.updateMany({ where: { draftId, status: "PENDING" }, data: { status: "REJECTED", decidedAt: new Date() } });
  await prisma.productDraft.delete({ where: { id: draftId } });
}

async function cleanupStaleDrafts(): Promise<void> {
  const stale = await prisma.productDraft.findMany({
    where: { consumedAt: null, createdAt: { lt: new Date(Date.now() - DRAFT_TTL_MS) } },
    select: { id: true },
  });
  for (const d of stale) await discardDraft(d.id);
}
