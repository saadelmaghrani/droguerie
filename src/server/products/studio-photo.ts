// Photo produit « studio » AUTOMATIQUE, pour toute photo ajoutée ou remplacée (admin, import) :
//   détourage local (ISNet, gratuit, sur le serveur) → un seul exemplaire si plusieurs copies identiques
//   (sauf lot / pack) → produit redressé s'il est penché →
//   centré sur un carré blanc #FFFFFF, 12 % de marge, ombre douce → WebP 320 / 800 / 1600.
// La photo d'origine est conservée (originalStorageKey) : « Rétablir l'originale » dans l'admin.
// Détourage impossible (modèle absent, aucun produit net) : la photo d'origine est gardée telle quelle.
import "server-only";

import { isMultiPack } from "@/lib/multi-pack";
import { AiError } from "@/server/ai/errors";
import { studioFromCutout } from "@/server/ai/studio-cutout";
import { deleteImageFiles, processImage, type ProcessedImage } from "@/server/media/images";

export type ProductPhoto = ProcessedImage & {
  source: "ORIGINAL" | "AI_STUDIO";
  /** Photo d'origine conservée quand la photo affichée est la version studio. */
  originalStorageKey: string | null;
};

export type ProductPhotoResult =
  | { ok: true; photo: ProductPhoto; /** Pourquoi la photo n'a pas été détourée (sinon absent). */ notice?: string }
  | { ok: false; error: string };

const NOTICES = {
  cutout_unavailable: "détourage non installé sur le serveur (npm run ai:model)",
  no_subject: "aucun produit net détecté sur la photo",
} as const;

/**
 * @param productName nom du produit : s'il n'indique pas un lot / pack, un seul exemplaire est gardé
 *   quand plusieurs copies identiques et séparées sont visibles.
 */
export async function processProductPhoto(file: File, subfolder: string, productName = ""): Promise<ProductPhotoResult> {
  // 1. Photo d'origine : validée, redressée (EXIF), sans métadonnées, conservée en grand format.
  const original = await processImage(file, "product", subfolder);
  if (!original.ok) return { ok: false, error: original.error };

  // 2. Version studio.
  try {
    const png = await studioFromCutout(Buffer.from(await file.arrayBuffer()), { singleItem: !isMultiPack(productName) });
    const studio = await processImage(new File([new Uint8Array(png)], "studio.png", { type: "image/png" }), "product", subfolder);
    if (!studio.ok) throw new Error(studio.error);
    return { ok: true, photo: { ...studio.image, source: "AI_STUDIO", originalStorageKey: original.image.key } };
  } catch (error) {
    const reason = error instanceof AiError && error.kind in NOTICES ? NOTICES[error.kind as keyof typeof NOTICES] : "traitement impossible";
    if (!(error instanceof AiError)) console.error("[photo studio] détourage impossible :", error);
    return { ok: true, photo: { ...original.image, source: "ORIGINAL", originalStorageKey: null }, notice: `Photo gardée telle quelle : ${reason}.` };
  }
}

/** Supprime tous les fichiers d'une photo traitée (en cas d'échec d'enregistrement). */
export async function deleteProductPhotoFiles(photo: ProductPhoto): Promise<void> {
  await Promise.all([photo.key, photo.originalStorageKey].filter((k): k is string => Boolean(k)).map((k) => deleteImageFiles(k, "product")));
}
