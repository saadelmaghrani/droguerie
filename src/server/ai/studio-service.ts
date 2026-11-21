// Service « photo fond studio » de la photo principale.
// Sans authentification : appelé par studio-actions.ts, qui vérifie l'admin AVANT.
//
// Cycle de vie (validation manuelle obligatoire) :
//   1. generate : la variante est créée À CÔTÉ (nouveaux fichiers + ai_generations PENDING) ;
//                 la photo du produit n'est PAS modifiée.
//   2. decide   : « Utiliser »  → la photo pointe vers la variante ; l'originale est CONSERVÉE
//                                  (original_storage_key) pour pouvoir revenir en arrière ;
//                 « Garder l'originale » → la variante est supprimée.
//   3. restore  : revenir à l'originale à tout moment.
import "server-only";

import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { deleteImageFiles, processImage } from "@/server/media/images";
import { localStorage } from "@/server/media/storage";
import { ACCOUNT_ACTION_KINDS, AiError, classifyOpenAiError } from "./errors";
import { studioFromCutout } from "./studio-cutout";
import { estimateImageCostUsd, studioFromOpenAi } from "./studio-openai";

export type StudioMethod = "cutout" | "openai";
type Failure = { ok: false; message: string; accountAction: boolean };
export type StudioResult = { ok: true; generationId: string; previewKey: string; originalKey: string; method: StudioMethod } | Failure;
export type DecideResult = { ok: true; message: string } | { ok: false; message: string };

type StudioOutput = { imageKey: string; width: number; height: number; imageId: string; method: StudioMethod };

const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

/** Variantes jamais validées (onglet fermé…) : fichiers supprimés après 24 h. */
async function cleanupStalePending(): Promise<void> {
  const stale = await prisma.aiGeneration.findMany({
    where: { type: "IMAGE_STUDIO", status: "PENDING", createdAt: { lt: new Date(Date.now() - PENDING_TTL_MS) } },
    select: { id: true, output: true },
  });
  for (const g of stale) {
    const out = g.output as StudioOutput | null;
    if (out?.imageKey) await deleteImageFiles(out.imageKey, "product");
    await prisma.aiGeneration.update({ where: { id: g.id }, data: { status: "REJECTED", decidedAt: new Date() } });
  }
}

export async function generateStudioVariant(imageId: string, method: StudioMethod, adminUserId: string): Promise<StudioResult> {
  await cleanupStalePending();
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) return { ok: false, message: "Cette photo n'existe plus.", accountAction: false };
  if (image.position !== 0) return { ok: false, message: "Le fond studio se fait sur la photo principale.", accountAction: false };

  // Toujours partir de la photo D'ORIGINE (jamais d'une variante déjà retouchée).
  const sourceKey = image.originalStorageKey ?? image.storageKey;
  const original = await localStorage.read(`${sourceKey}-orig.webp`);
  if (!original) return { ok: false, message: "Fichier de la photo introuvable sur le serveur.", accountAction: false };

  const started = Date.now();
  let usage = { model: "isnet-general-use", inputTokens: 0, outputTokens: 0 };
  try {
    let png: Buffer;
    if (method === "cutout") png = await studioFromCutout(original);
    else {
      const result = await studioFromOpenAi(original);
      png = result.png;
      usage = { model: result.model, inputTokens: result.inputTokens, outputTokens: result.outputTokens };
    }

    const processed = await processImage(new File([new Uint8Array(png)], "studio.png", { type: "image/png" }), "product", image.productId);
    if (!processed.ok) throw new AiError("bad_response", processed.error);

    const output: StudioOutput = { imageKey: processed.image.key, width: processed.image.width, height: processed.image.height, imageId, method };
    const generation = await prisma.aiGeneration.create({
      data: {
        type: "IMAGE_STUDIO",
        status: "PENDING",
        productId: image.productId,
        adminUserId,
        inputImageKey: sourceKey,
        output,
        provider: method === "cutout" ? "local" : "openai",
        model: usage.model,
        inputTokens: method === "openai" ? usage.inputTokens : null,
        outputTokens: method === "openai" ? usage.outputTokens : null,
        imagesCount: 1,
        estimatedCostUsd: method === "openai" ? estimateImageCostUsd(usage.model, usage.inputTokens, usage.outputTokens) : 0,
        durationMs: Date.now() - started,
      },
      select: { id: true },
    });
    return { ok: true, generationId: generation.id, previewKey: processed.image.key, originalKey: sourceKey, method };
  } catch (error) {
    const aiError = classifyOpenAiError(error);
    if (aiError.kind !== "not_configured") {
      console.error(`[IA] Fond studio (${method}) impossible : ${aiError.kind} ${aiError.detail ?? ""}`);
      await prisma.aiGeneration.create({
        data: {
          type: "IMAGE_STUDIO",
          status: "FAILED",
          productId: image.productId,
          adminUserId,
          inputImageKey: sourceKey,
          provider: method === "cutout" ? "local" : "openai",
          model: method === "cutout" ? "isnet-general-use" : usage.model,
          durationMs: Date.now() - started,
          errorMessage: `${aiError.kind}: ${aiError.detail ?? ""}`.slice(0, 500),
        },
      });
    }
    return { ok: false, message: aiError.message, accountAction: ACCOUNT_ACTION_KINDS.includes(aiError.kind) };
  }
}

export async function decideStudioVariant(generationId: string, accepted: boolean): Promise<DecideResult> {
  const generation = await prisma.aiGeneration.findFirst({
    where: { id: generationId, type: "IMAGE_STUDIO", status: "PENDING" },
    select: { id: true, output: true, inputImageKey: true },
  });
  if (!generation) return { ok: false, message: "Cette proposition n'est plus disponible. Générez-en une nouvelle." };
  const out = generation.output as unknown as StudioOutput;

  if (!accepted) {
    await prisma.aiGeneration.update({ where: { id: generation.id }, data: { status: "REJECTED", decidedAt: new Date() } });
    await deleteImageFiles(out.imageKey, "product");
    return { ok: true, message: "Photo originale conservée." };
  }

  const toDelete = await prisma.$transaction(async (tx) => {
    const image = await tx.productImage.findUnique({ where: { id: out.imageId } });
    // La photo a été supprimée ou remplacée entre-temps : on n'écrase rien.
    if (!image || (image.originalStorageKey ?? image.storageKey) !== generation.inputImageKey) return null;
    await tx.productImage.update({
      where: { id: image.id },
      data: {
        storageKey: out.imageKey,
        width: out.width,
        height: out.height,
        source: "AI_STUDIO",
        originalStorageKey: image.originalStorageKey ?? image.storageKey,
      },
    });
    await tx.aiGeneration.update({ where: { id: generation.id }, data: { status: "ACCEPTED", decidedAt: new Date() } });
    // Ancienne variante studio remplacée par la nouvelle : ses fichiers ne servent plus.
    return image.originalStorageKey ? image.storageKey : "";
  });

  if (toDelete === null) {
    await prisma.aiGeneration.update({ where: { id: generation.id }, data: { status: "REJECTED", decidedAt: new Date() } });
    await deleteImageFiles(out.imageKey, "product");
    return { ok: false, message: "La photo principale a changé entre-temps. Relancez le fond studio." };
  }
  if (toDelete) await deleteImageFiles(toDelete, "product");
  return { ok: true, message: "Photo fond studio utilisée. L'originale est conservée : vous pouvez y revenir à tout moment." };
}

export async function restoreOriginalImage(imageId: string): Promise<DecideResult> {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) return { ok: false, message: "Cette photo n'existe plus." };
  if (!image.originalStorageKey) return { ok: true, message: "C'est déjà la photo originale." };
  const original = await localStorage.read(`${image.originalStorageKey}-orig.webp`);
  const meta = original ? await sharp(original).metadata() : null;
  await prisma.productImage.update({
    where: { id: imageId },
    data: {
      storageKey: image.originalStorageKey,
      originalStorageKey: null,
      source: "ORIGINAL",
      width: meta?.width ?? image.width,
      height: meta?.height ?? image.height,
    },
  });
  await deleteImageFiles(image.storageKey, "product");
  return { ok: true, message: "Photo originale rétablie." };
}
