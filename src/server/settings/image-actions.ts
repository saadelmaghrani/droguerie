"use server";
// Logo et image de bannière du magasin. Points d'entrée publics : requireAdmin() en premier.

import { refresh } from "next/cache";
import { invalidateCatalogue } from "@/server/catalogue/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/dal";
import { deleteImageFiles, processImage, readUploadedFile } from "@/server/media/images";
import { getStoreSettings } from "./service";

type Kind = "logo" | "hero";
type Result = { ok: boolean; message: string };

const FIELD = { logo: "logoKey", hero: "heroImageKey" } as const;
const LABEL = { logo: "Logo", hero: "Image de la bannière" } as const;

function isKind(value: unknown): value is Kind {
  return value === "logo" || value === "hero";
}

export async function uploadStoreImage(kind: Kind, formData: FormData): Promise<Result> {
  await requireAdmin();
  if (!isKind(kind) || !(formData instanceof FormData)) return { ok: false, message: "Requête invalide." };

  const upload = readUploadedFile(formData.get("file"));
  if (!upload.ok) return { ok: false, message: upload.error };
  const processed = await processImage(upload.file, kind);
  if (!processed.ok) return { ok: false, message: processed.error };

  await getStoreSettings(); // garantit l'existence de la ligne de paramètres
  const previous = await prisma.storeSettings.findUnique({ where: { id: 1 }, select: { logoKey: true, heroImageKey: true } });
  await prisma.storeSettings.update({ where: { id: 1 }, data: { [FIELD[kind]]: processed.image.key } });
  const oldKey = previous?.[FIELD[kind]];
  if (oldKey) await deleteImageFiles(oldKey, kind);

  refresh();

  invalidateCatalogue();
  return { ok: true, message: `${LABEL[kind]} enregistré${kind === "hero" ? "e" : ""}.` };
}

export async function removeStoreImage(kind: Kind): Promise<Result> {
  await requireAdmin();
  if (!isKind(kind)) return { ok: false, message: "Requête invalide." };

  const settings = await prisma.storeSettings.findUnique({ where: { id: 1 }, select: { logoKey: true, heroImageKey: true } });
  const key = settings?.[FIELD[kind]];
  if (!key) return { ok: true, message: "Aucune image à retirer." };
  await prisma.storeSettings.update({ where: { id: 1 }, data: { [FIELD[kind]]: null } });
  await deleteImageFiles(key, kind);

  refresh();

  invalidateCatalogue();
  return { ok: true, message: `${LABEL[kind]} retiré${kind === "hero" ? "e" : ""}.` };
}
