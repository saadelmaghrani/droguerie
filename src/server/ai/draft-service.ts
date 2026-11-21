// Brouillon IA d'un NOUVEAU produit (page « Nouveau produit », bouton « Générer avec l'IA »).
// Sans authentification : appelé par draft-actions.ts, qui vérifie l'admin AVANT.
//
// 1. createProductDraft : la photo envoyée est enregistrée, puis EN PARALLÈLE :
//      - photo principale fond blanc (détourage local, produit intact au pixel près) ;
//      - 2 mises en scène (OpenAI) ;
//      - nom + description (OpenAI, lecture de la photo).
//    Chaque partie peut échouer seule : les autres restent utilisables.
// 2. attachDraftToProduct : après « Créer le produit », SEULES les photos choisies par l'admin
//    sont rattachées ; les autres fichiers sont supprimés.
// 3. Brouillon abandonné (page fermée) : tout est supprimé après 24 h.
import "server-only";

import { prisma } from "@/lib/prisma";
import { deleteImageFiles, processImage, type ProcessedImage } from "@/server/media/images";
import { localStorage } from "@/server/media/storage";
import type { AiGenerationType } from "@/generated/prisma/client";
import { ACCOUNT_ACTION_KINDS, AiError, classifyOpenAiError } from "./errors";
import { generateProductText } from "./product-text";
import { estimateCostUsd, type ProductTextHints } from "./product-text-prompt";
import { estimateImageCostUsd, sceneFromOpenAi } from "./scenes-openai";
import { studioFromCutout } from "./studio-cutout";

export type DraftImage = { key: string; width: number; height: number };
export type DraftPart<T> = { ok: true; value: T } | { ok: false; message: string; accountAction: boolean };
export type DraftText = { name: string; description: string };
export type DraftResult =
  | {
      ok: true;
      draftId: string;
      original: DraftImage;
      studio: DraftPart<DraftImage>;
      scenes: DraftPart<DraftImage>[];
      text: DraftPart<DraftText>;
    }
  | { ok: false; message: string };

export type DraftChoice = { main: "studio" | "original"; keepScenes: boolean[] };

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const SCENE_COUNT = 2;

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

export async function createProductDraft(file: File, hints: ProductTextHints, adminUserId: string): Promise<DraftResult> {
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

  const studio = runPart<DraftImage>(ctx, "IMAGE_STUDIO", "local", "isnet-general-use", async () => {
    const image = toDraftImage(await storePng(await studioFromCutout(full), draftId, "studio.png"));
    return { value: image, output: { ...image, role: "studio" }, model: "isnet-general-use", costUsd: 0 };
  });
  const scenes = Array.from({ length: SCENE_COUNT }, (_, index) =>
    runPart<DraftImage>(ctx, "IMAGE_SCENE", "openai", "", async () => {
      const result = await sceneFromOpenAi(full, index as 0 | 1);
      const image = toDraftImage(await storePng(result.png, draftId, `scene-${index}.png`));
      return {
        value: image,
        output: { ...image, role: "scene", index },
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: estimateImageCostUsd(result.model, result.inputTokens, result.outputTokens),
      };
    }),
  );
  const text = runPart<DraftText>(ctx, "TEXT", "openai", "", async () => {
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

  const [studioResult, textResult, ...sceneResults] = await Promise.all([studio, text, ...scenes]);
  return { ok: true, draftId, original, studio: studioResult, scenes: sceneResults, text: textResult };
}

type ImageOutput = DraftImage & { role: "studio" | "scene"; index?: number };

/** Rattache les photos CHOISIES au produit créé ; supprime les fichiers non retenus. */
export async function attachDraftToProduct(productId: string, draftId: string, choice: DraftChoice): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const draft = await prisma.productDraft.findUnique({ where: { id: draftId } });
  if (!draft || draft.consumedAt) return { ok: false, message: "Les photos générées ont expiré : ajoutez-les depuis la fiche." };
  const generations = await prisma.aiGeneration.findMany({ where: { draftId, status: "PENDING" } });
  const outputOf = (g: (typeof generations)[number]) => g.output as unknown as ImageOutput;
  const studioGen = generations.find((g) => g.type === "IMAGE_STUDIO");
  const sceneGens = generations.filter((g) => g.type === "IMAGE_SCENE").sort((a, b) => (outputOf(a).index ?? 0) - (outputOf(b).index ?? 0));

  const useStudio = choice.main === "studio" && studioGen !== undefined;
  const keptScenes = sceneGens.filter((g) => choice.keepScenes[outputOf(g).index ?? -1] === true);
  const unused = [
    ...(studioGen && !useStudio ? [outputOf(studioGen).key] : []),
    ...sceneGens.filter((g) => !keptScenes.includes(g)).map((g) => outputOf(g).key),
  ];

  const result = await prisma.$transaction(async (tx) => {
    if ((await tx.productImage.count({ where: { productId } })) > 0) return null; // produit déjà illustré
    const main = useStudio
      ? { storageKey: outputOf(studioGen!).key, width: outputOf(studioGen!).width, height: outputOf(studioGen!).height, source: "AI_STUDIO" as const, originalStorageKey: draft.originalKey }
      : { storageKey: draft.originalKey, width: draft.originalWidth, height: draft.originalHeight, source: "ORIGINAL" as const, originalStorageKey: null };
    const rows = [
      main,
      ...keptScenes.map((g) => ({ storageKey: outputOf(g).key, width: outputOf(g).width, height: outputOf(g).height, source: "AI_GENERATED" as const, originalStorageKey: null })),
    ];
    await tx.productImage.createMany({ data: rows.map((r, position) => ({ ...r, productId, position })) });
    const accepted = new Set([...(useStudio ? [studioGen!.id] : []), ...keptScenes.map((g) => g.id), ...generations.filter((g) => g.type === "TEXT").map((g) => g.id)]);
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
