// Images : tailles générées et construction des URL (logique pure : serveur + navigateur).
//
// Chaque image est enregistrée sous une « clé » (ex. products/<id>/<aléatoire>) et déclinée
// en plusieurs fichiers WebP : <clé>-320.webp, <clé>-800.webp, …
// Les fichiers sont servis par la route /media/[...path].

export const IMAGE_PRESETS = {
  /** Photos produit : vignette (liste), moyenne (catalogue), grande (fiche). */
  product: { folder: "products", widths: [320, 800, 1600] as const, keepOriginal: true },
  /** Logo du magasin (transparence conservée). */
  logo: { folder: "settings/logo", widths: [128, 256, 512] as const, keepOriginal: false },
  /** Image de la bannière d'accueil. */
  hero: { folder: "settings/hero", widths: [800, 1600, 2400] as const, keepOriginal: false },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

/** Taille maximale d'un fichier envoyé (voir aussi next.config.ts : bodySizeLimit). */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/avif,image/gif,image/tiff";

export function mediaUrl(key: string, width: number | "orig"): string {
  return `/media/${key}-${width}.webp`;
}

/** Attribut srcset : le navigateur choisit la taille adaptée à l'écran. */
export function mediaSrcSet(key: string, preset: ImagePreset): string {
  return IMAGE_PRESETS[preset].widths.map((w) => `${mediaUrl(key, w)} ${w}w`).join(", ");
}
