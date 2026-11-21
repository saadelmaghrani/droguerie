"use server";
// Actions serveur des photos produit. Points d'entrée publics : requireAdmin() en premier,
// AVANT de lire le fichier envoyé.

import { refresh } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/dal";
import { processImage, readUploadedFile } from "@/server/media/images";
import {
  addProductImage,
  countProductImages,
  deleteProductImage,
  makePrimaryImage,
  MAX_PRODUCT_IMAGES,
  moveImage,
  replaceProductImage,
  restoreOriginalImage,
  type ImageServiceResult,
} from "./images-service";

const uuid = z.uuid();
const INVALID: ImageServiceResult = { ok: false, message: "Requête invalide." };

export async function uploadProductImage(productId: string, formData: FormData): Promise<ImageServiceResult> {
  await requireAdmin();
  if (!uuid.safeParse(productId).success || !(formData instanceof FormData)) return INVALID;

  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return { ok: false, message: "Ce produit n'existe plus." };
  // Vérification AVANT le traitement (coûteux) de l'image.
  if ((await countProductImages(productId)) >= MAX_PRODUCT_IMAGES) {
    return { ok: false, message: `Ce produit a déjà ${MAX_PRODUCT_IMAGES} photos. Supprimez-en une d'abord.` };
  }

  const upload = readUploadedFile(formData.get("file"));
  if (!upload.ok) return { ok: false, message: upload.error };
  const processed = await processImage(upload.file, "product", productId);
  if (!processed.ok) return { ok: false, message: processed.error };

  const result = await addProductImage(productId, processed.image);
  if (result.ok) refresh();
  return result;
}

export async function replaceProductImageFile(imageId: string, formData: FormData): Promise<ImageServiceResult> {
  await requireAdmin();
  if (!uuid.safeParse(imageId).success || !(formData instanceof FormData)) return INVALID;
  const image = await prisma.productImage.findUnique({ where: { id: imageId }, select: { productId: true } });
  if (!image) return { ok: false, message: "Cette photo n'existe plus." };

  const upload = readUploadedFile(formData.get("file"));
  if (!upload.ok) return { ok: false, message: upload.error };
  const processed = await processImage(upload.file, "product", image.productId);
  if (!processed.ok) return { ok: false, message: processed.error };

  const result = await replaceProductImage(imageId, processed.image);
  if (result.ok) refresh();
  return result;
}

async function run(imageId: unknown, operation: (id: string) => Promise<ImageServiceResult>): Promise<ImageServiceResult> {
  await requireAdmin();
  const parsed = uuid.safeParse(imageId);
  if (!parsed.success) return INVALID;
  const result = await operation(parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function removeProductImage(imageId: string): Promise<ImageServiceResult> {
  return run(imageId, deleteProductImage);
}

export async function setPrimaryProductImage(imageId: string): Promise<ImageServiceResult> {
  return run(imageId, makePrimaryImage);
}

export async function moveProductImage(imageId: string, direction: "left" | "right"): Promise<ImageServiceResult> {
  return run(imageId, (id) => (direction === "left" || direction === "right" ? moveImage(id, direction) : Promise.resolve(INVALID)));
}

export async function restoreOriginalProductImage(imageId: string): Promise<ImageServiceResult> {
  await requireAdmin();
  if (!uuid.safeParse(imageId).success) return INVALID;
  const result = await restoreOriginalImage(imageId);
  if (result.ok) refresh();
  return result;
}
