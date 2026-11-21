"use server";
// Actions serveur « photo fond studio ». Points d'entrée publics : requireAdmin() en premier.

import { refresh } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/dal";
import { decideStudioVariant, generateStudioVariant, restoreOriginalImage, type DecideResult, type StudioResult } from "./studio-service";

const uuid = z.uuid();
const INVALID = { ok: false as const, message: "Requête invalide." };

export async function generateStudioAction(imageId: string, method: "cutout" | "openai"): Promise<StudioResult> {
  const admin = await requireAdmin();
  if (!uuid.safeParse(imageId).success || (method !== "cutout" && method !== "openai")) return { ...INVALID, accountAction: false };
  return generateStudioVariant(imageId, method, admin.id);
}

/** « Utiliser » (accepted = true) ou « Garder l'originale ». */
export async function decideStudioAction(generationId: string, accepted: boolean): Promise<DecideResult> {
  await requireAdmin();
  if (!uuid.safeParse(generationId).success || typeof accepted !== "boolean") return INVALID;
  const result = await decideStudioVariant(generationId, accepted);
  if (result.ok && accepted) refresh();
  return result;
}

export async function restoreOriginalImageAction(imageId: string): Promise<DecideResult> {
  await requireAdmin();
  if (!uuid.safeParse(imageId).success) return INVALID;
  const result = await restoreOriginalImage(imageId);
  if (result.ok) refresh();
  return result;
}
