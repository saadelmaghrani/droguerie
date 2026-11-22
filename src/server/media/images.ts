// Traitement des images envoyées : validation du VRAI format, redressement, suppression des
// métadonnées (EXIF/GPS), génération des tailles en WebP.
import "server-only";

import { randomBytes } from "node:crypto";
import sharp, { type Metadata } from "sharp";
import { IMAGE_PRESETS, MAX_UPLOAD_BYTES, type ImagePreset } from "@/lib/media";
import { localStorage } from "./storage";

/** Formats acceptés, d'après le contenu réel du fichier (pas son extension). SVG refusé (peut contenir du script). */
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "heif", "gif", "tiff"]);
/** Protection contre les « bombes » d'images (fichier léger mais immense une fois décodé). */
const MAX_INPUT_PIXELS = 50_000_000; // ~ 8 000 × 6 000

export type ProcessedImage = { key: string; width: number; height: number };
export type ImageResult = { ok: true; image: ProcessedImage } | { ok: false; error: string };

const MB = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} Mo`;

/** Vérifie la valeur reçue d'un formulaire : un vrai fichier, non vide, pas trop lourd. */
export function readUploadedFile(value: FormDataEntryValue | null): { ok: true; file: File } | { ok: false; error: string } {
  if (!(value instanceof File) || value.size === 0) return { ok: false, error: "Aucun fichier reçu." };
  if (value.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `Fichier trop lourd (${MB(value.size)}). Maximum : ${MB(MAX_UPLOAD_BYTES)}.` };
  }
  return { ok: true, file: value };
}

/** Clé de stockage unique et imprévisible : <dossier>/<sous-dossier>/<32 caractères hexadécimaux>. */
function newKey(preset: ImagePreset, subfolder?: string): string {
  const folder = IMAGE_PRESETS[preset].folder + (subfolder ? `/${subfolder}` : "");
  return `${folder}/${randomBytes(16).toString("hex")}`;
}

export function variantSuffixes(preset: ImagePreset): string[] {
  const { widths, keepOriginal } = IMAGE_PRESETS[preset];
  return [...widths.map(String), ...(keepOriginal ? ["orig"] : [])];
}

export async function processImage(file: File, preset: ImagePreset, subfolder?: string): Promise<ImageResult> {
  const input = Buffer.from(await file.arrayBuffer());

  let metadata: Metadata;
  try {
    // Lecture de l'EN-TÊTE uniquement (dimensions, format) : rien n'est décodé à ce stade,
    // la limite de pixels est donc vérifiée juste après, avec un message clair.
    metadata = await sharp(input, { limitInputPixels: false }).metadata();
  } catch {
    return { ok: false, error: "Ce fichier n'est pas une image lisible." };
  }
  if (!metadata.format || !ACCEPTED_FORMATS.has(metadata.format)) {
    return { ok: false, error: "Format non accepté. Utilisez une photo JPEG, PNG ou WebP." };
  }
  if (metadata.width * metadata.height > MAX_INPUT_PIXELS) {
    return { ok: false, error: "Image trop grande (plus de 50 millions de pixels). Réduisez sa taille avant de l'envoyer." };
  }
  if (!metadata.width || !metadata.height || metadata.width < 200 || metadata.height < 200) {
    return { ok: false, error: "Image trop petite (200 × 200 pixels minimum)." };
  }

  const key = newKey(preset, subfolder);
  const { widths, keepOriginal } = IMAGE_PRESETS[preset];
  const written: string[] = [];

  try {
    // L'orientation EXIF (photos de téléphone) est appliquée explicitement par autoOrient()
    // dans chaque chaîne ci-dessous. sharp n'écrit ensuite AUCUNE métadonnée en sortie
    // (ni EXIF, ni position GPS).
    const base = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, animated: false });
    // Dimensions APRÈS redressement (une photo portrait prise en paysage inverse largeur/hauteur).
    const { width, height } = metadata.autoOrient;

    const targets: { suffix: string; width: number; quality: number }[] = [
      ...widths.map((w) => ({ suffix: String(w), width: w, quality: 80 })),
      ...(keepOriginal ? [{ suffix: "orig", width: 2400, quality: 90 }] : []),
    ];
    for (const target of targets) {
      const oriented = base.clone().autoOrient();
      // Logo : marges unies retirées (sinon il paraît minuscule dans l'en-tête).
      if (preset === "logo") oriented.trim({ threshold: 20 });
      const data = await oriented
        .resize({ width: target.width, height: target.width, fit: "inside", withoutEnlargement: true })
        .webp({ quality: target.quality, effort: 4 })
        .toBuffer();
      const fileName = `${key}-${target.suffix}.webp`;
      await localStorage.write(fileName, data);
      written.push(target.suffix);
    }
    return { ok: true, image: { key, width, height } };
  } catch (error) {
    // Échec en cours de route (ex. HEIC iPhone non décodable) : on ne laisse aucun fichier orphelin.
    await localStorage.removeVariants(key, written);
    console.error("[images] traitement impossible :", error);
    const isHeic = metadata.format === "heif" && metadata.compression === "hevc";
    return {
      ok: false,
      error: isHeic
        ? "Format HEIC (iPhone) non pris en charge. Envoyez la photo en JPEG (iPhone : Réglages → Appareil photo → Formats → « Le plus compatible »)."
        : "Impossible de traiter cette image. Essayez avec une autre photo.",
    };
  }
}

export async function deleteImageFiles(key: string, preset: ImagePreset): Promise<void> {
  await localStorage.removeVariants(key, variantSuffixes(preset));
}
