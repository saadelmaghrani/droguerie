// Photos des produits : 3 emplacements (0 = principale, 1 et 2 = secondaires).
// Sans authentification : appelé par image-actions.ts, qui vérifie l'admin d'abord.
import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { deleteImageFiles, type ProcessedImage } from "@/server/media/images";

export const MAX_PRODUCT_IMAGES = 3;
export type ImageServiceResult = { ok: true; message: string } | { ok: false; message: string };

export type ProductImageRow = { id: string; position: number; storageKey: string; width: number; height: number };

const NOT_FOUND: ImageServiceResult = { ok: false, message: "Cette photo n'existe plus." };

export async function listProductImages(productId: string): Promise<ProductImageRow[]> {
  return prisma.productImage.findMany({
    where: { productId },
    orderBy: { position: "asc" },
    select: { id: true, position: true, storageKey: true, width: true, height: true },
  });
}

export async function countProductImages(productId: string): Promise<number> {
  return prisma.productImage.count({ where: { productId } });
}

/** Ajoute une photo au premier emplacement libre. En cas d'échec, les fichiers sont supprimés. */
export async function addProductImage(productId: string, image: ProcessedImage): Promise<ImageServiceResult> {
  try {
    const position = await prisma.$transaction(async (tx) => {
      const used = new Set((await tx.productImage.findMany({ where: { productId }, select: { position: true } })).map((i) => i.position));
      const free = [0, 1, 2].find((p) => !used.has(p));
      if (free === undefined) return null;
      await tx.productImage.create({
        data: { productId, position: free, storageKey: image.key, width: image.width, height: image.height, source: "ORIGINAL" },
      });
      return free;
    });
    if (position === null) {
      await deleteImageFiles(image.key, "product");
      return { ok: false, message: `Ce produit a déjà ${MAX_PRODUCT_IMAGES} photos. Supprimez-en une d'abord.` };
    }
    return { ok: true, message: position === 0 ? "Photo principale ajoutée." : "Photo ajoutée." };
  } catch (error) {
    await deleteImageFiles(image.key, "product");
    // Deux envois simultanés sur le même emplacement : la base refuse le second (unicité).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: "Un autre envoi est en cours sur ce produit. Réessayez." };
    }
    throw error;
  }
}

/** Remplace le fichier d'une photo existante (même emplacement). */
export async function replaceProductImage(imageId: string, image: ProcessedImage): Promise<ImageServiceResult> {
  const current = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!current) {
    await deleteImageFiles(image.key, "product");
    return NOT_FOUND;
  }
  await prisma.productImage.update({
    where: { id: imageId },
    data: { storageKey: image.key, width: image.width, height: image.height, source: "ORIGINAL", originalStorageKey: null },
  });
  await deleteImageFiles(current.storageKey, "product");
  return { ok: true, message: "Photo remplacée." };
}

/** Supprime une photo, puis resserre les emplacements (la principale reste toujours en 0). */
export async function deleteProductImage(imageId: string): Promise<ImageServiceResult> {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) return NOT_FOUND;
  await prisma.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { id: imageId } });
    // Décalage dans l'ordre croissant : chaque emplacement cible vient d'être libéré.
    const after = await tx.productImage.findMany({
      where: { productId: image.productId, position: { gt: image.position } },
      orderBy: { position: "asc" },
    });
    for (const next of after) {
      await tx.productImage.update({ where: { id: next.id }, data: { position: next.position - 1 } });
    }
  });
  await deleteImageFiles(image.storageKey, "product");
  return {
    ok: true,
    message: image.position === 0 ? "Photo supprimée. La suivante devient la photo principale." : "Photo supprimée.",
  };
}

/**
 * Échange le CONTENU de deux emplacements (et non leurs positions) : la base interdit deux
 * photos au même emplacement et les positions hors 0–2, donc pas de position « temporaire ».
 */
async function swapWithPosition(imageId: string, targetPosition: number): Promise<ImageServiceResult | null> {
  return prisma.$transaction(async (tx) => {
    const a = await tx.productImage.findUnique({ where: { id: imageId } });
    if (!a) return NOT_FOUND;
    const b = await tx.productImage.findUnique({ where: { productId_position: { productId: a.productId, position: targetPosition } } });
    if (!b) return { ok: false, message: "Déplacement impossible." };
    const content = (i: typeof a) => ({
      storageKey: i.storageKey,
      originalStorageKey: i.originalStorageKey,
      source: i.source,
      width: i.width,
      height: i.height,
    });
    await tx.productImage.update({ where: { id: a.id }, data: content(b) });
    await tx.productImage.update({ where: { id: b.id }, data: content(a) });
    return null;
  });
}

export async function makePrimaryImage(imageId: string): Promise<ImageServiceResult> {
  const image = await prisma.productImage.findUnique({ where: { id: imageId }, select: { position: true } });
  if (!image) return NOT_FOUND;
  if (image.position === 0) return { ok: true, message: "C'est déjà la photo principale." };
  return (await swapWithPosition(imageId, 0)) ?? { ok: true, message: "Photo principale mise à jour." };
}

export async function moveImage(imageId: string, direction: "left" | "right"): Promise<ImageServiceResult> {
  const image = await prisma.productImage.findUnique({ where: { id: imageId }, select: { position: true } });
  if (!image) return NOT_FOUND;
  const target = image.position + (direction === "left" ? -1 : 1);
  if (target < 0 || target >= MAX_PRODUCT_IMAGES) return { ok: false, message: "Déplacement impossible." };
  return (await swapWithPosition(imageId, target)) ?? { ok: true, message: "Ordre des photos mis à jour." };
}

/** Clés des photos d'un produit (pour supprimer les fichiers quand le produit est supprimé). */
export async function productImageKeys(productId: string): Promise<string[]> {
  return (await prisma.productImage.findMany({ where: { productId }, select: { storageKey: true, originalStorageKey: true } }))
    .flatMap((i) => [i.storageKey, i.originalStorageKey])
    .filter((k): k is string => Boolean(k));
}
