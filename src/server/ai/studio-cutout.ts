// Photo « fond studio » FIDÈLE : détourage local (modèle ISNet, exécuté sur le serveur, gratuit)
// puis pose du produit sur un fond uniforme avec une ombre douce.
//
// Garantie : le produit n'est PAS redessiné ni redimensionné. Ses pixels sont copiés tels quels
// depuis la photo d'origine ; seuls le fond (remplacé) et le bord (fondu du détourage) changent.
// Prétraitement identique à rembg (session « isnet-general-use ») :
//   RGB → 1024×1024 (Lanczos) → ÷ valeur max → − 0,5 → NCHW float32 ; sortie normalisée min-max.
import "server-only";

import { existsSync } from "node:fs";
import path from "node:path";
import * as ort from "onnxruntime-node";
import sharp, { type OverlayOptions } from "sharp";
import { AiError } from "./errors";

const SIZE = 1024;
export const STUDIO_BACKGROUND = { r: 255, g: 255, b: 255 }; // fond blanc pur uniforme
/** Le produit occupe au plus 82 % du côté de l'image (marges régulières). */
const FILL_RATIO = 0.82;

export function cutoutModelPath(): string {
  const dir = process.env.MODELS_DIR || path.join(process.cwd(), "storage", "models");
  return path.resolve(/*turbopackIgnore: true*/ dir, "isnet-general-use.onnx");
}

let session: Promise<ort.InferenceSession> | null = null;
function getSession(): Promise<ort.InferenceSession> {
  const file = cutoutModelPath();
  if (!existsSync(/*turbopackIgnore: true*/ file)) throw new AiError("cutout_unavailable", file);
  // Chargé une seule fois (≈ 1 s), puis gardé en mémoire.
  session ??= ort.InferenceSession.create(file, { graphOptimizationLevel: "all" }).catch((error) => {
    session = null;
    throw error;
  });
  return session;
}

/** Masque de détourage (0 = fond, 255 = produit), à la taille de l'image. */
export async function cutoutMask(rgb: Buffer, width: number, height: number): Promise<Buffer> {
  const small = await sharp(rgb, { raw: { width, height, channels: 3 } })
    .resize(SIZE, SIZE, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer();
  let max = 1e-6;
  for (const v of small) if (v > max) max = v;
  const plane = SIZE * SIZE;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) input[c * plane + i] = small[i * 3 + c]! / max - 0.5;
  }

  const model = await getSession();
  const outputs = await model.run({ [model.inputNames[0]!]: new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) });
  const pred = outputs[model.outputNames[0]!]!.data as Float32Array; // forme 1×1×1024×1024

  let lo = Infinity;
  let hi = -Infinity;
  let confident = 0;
  for (let i = 0; i < plane; i++) {
    const v = pred[i]!;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
    if (v > 0.5) confident++;
  }
  // Sortie du modèle entre 0 et 1. Sans zone « produit » sûre à plus de 50 % (≥ 1 % de l'image),
  // la normalisation ci-dessous transformerait du bruit en faux produit : on refuse.
  if (confident < plane * 0.01) throw new AiError("no_subject", `confiance max ${hi.toFixed(3)}`);
  const range = hi - lo || 1;
  const mask = Buffer.alloc(plane);
  for (let i = 0; i < plane; i++) mask[i] = Math.round(((pred[i]! - lo) / range) * 255);

  return sharp(mask, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .resize(width, height, { fit: "fill", kernel: "lanczos3" })
    .extractChannel(0)
    .raw()
    .toBuffer();
}

/**
 * Nettoie le masque : supprime le halo léger du fond, rend l'intérieur du produit pleinement opaque.
 * Seuils 10 % / 90 % : au-dessus de 90 % de confiance, le pixel du produit est conservé à 100 %.
 */
export function refineAlpha(mask: Buffer): Buffer {
  const lo = 26;
  const hi = 230;
  const out = Buffer.alloc(mask.length);
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i]!;
    out[i] = v <= lo ? 0 : v >= hi ? 255 : Math.round(((v - lo) / (hi - lo)) * 255);
  }
  return out;
}

/** Rectangle englobant les pixels visibles du masque, ou null si (presque) rien n'a été détecté. */
export function alphaBounds(alpha: Buffer, width: number, height: number) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x]! > 16) {
        count++;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0 || count < width * height * 0.01) return null; // moins de 1 % de l'image : pas de produit net
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/** Produit détouré : pixels d'origine + transparence, recadré au plus près. Jamais redimensionné. */
export type CutoutProduct = { png: Buffer; width: number; height: number };

/** Photo d'origine (n'importe quel format lisible) → produit détouré. Lève AiError("no_subject"). */
export async function cutoutProduct(original: Buffer): Promise<CutoutProduct> {
  const { data: rgb, info } = await sharp(original).autoOrient().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const alpha = refineAlpha(await cutoutMask(rgb, width, height));
  const box = alphaBounds(alpha, width, height);
  if (!box) throw new AiError("no_subject");
  // Deux étapes : dans une même chaîne sharp, extract() serait appliqué AVANT joinChannel() (et ignoré).
  const rgba = await sharp(rgb, { raw: { width, height, channels: 3 } })
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .raw()
    .toBuffer();
  const png = await sharp(rgba, { raw: { width, height, channels: 4 } }).extract(box).png().toBuffer();
  return { png, width: box.width, height: box.height };
}

/** Ombre de contact floue (ellipse) sous la base du produit. */
function contactShadow(width: number, height: number, cx: number, baseY: number, productW: number, productH: number, opacity: number): Buffer {
  const rx = Math.round(productW * 0.45);
  const ry = Math.max(5, Math.round(productH * 0.025));
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${Math.max(3, ry * 0.9)}"/></filter></defs>
      <ellipse cx="${cx}" cy="${baseY - ry * 0.2}" rx="${rx}" ry="${ry}" fill="#000" fill-opacity="${opacity}" filter="url(#b)"/>
    </svg>`,
  );
}

/** Photo principale : produit à l'échelle 1:1 sur fond blanc pur, ombre douce. */
export async function composeWhite(cut: CutoutProduct): Promise<Buffer> {
  const side = Math.max(Math.ceil(Math.max(cut.width, cut.height) / FILL_RATIO), 400);
  const left = Math.round((side - cut.width) / 2);
  const top = Math.round((side - cut.height) / 2);
  return sharp({ create: { width: side, height: side, channels: 3, background: STUDIO_BACKGROUND } })
    .composite([
      { input: contactShadow(side, side, side / 2, top + cut.height, cut.width, cut.height, 0.18), left: 0, top: 0 },
      { input: cut.png, left, top },
    ])
    .png()
    .toBuffer();
}

export type MontageStyle = "studio" | "table";
export const MONTAGE_LABELS: Record<MontageStyle, string> = {
  studio: "Studio dégradé avec reflet",
  table: "Sur une table en bois clair",
};

/**
 * Photo supplémentaire « mise en scène » SANS IA générative : le produit détouré (pixels d'origine,
 * échelle 1:1) est posé sur un décor dessiné par le code (aucune image tierce, aucun droit d'auteur).
 *  - studio : fond dégradé gris-blanc, sol légèrement brillant avec reflet du produit ;
 *  - table  : mur crème + plateau en bois clair (veinage procédural), ombre de contact.
 */
/** Position du produit dans un montage (exportée pour le test de fidélité des pixels). */
export function montageLayout(cut: { width: number; height: number }, style: MontageStyle) {
  // Le produit occupe ~68 % de la hauteur : place pour le sol / le plateau.
  const side = Math.max(Math.ceil(Math.max(cut.width / 0.8, cut.height / 0.68)), 400);
  const left = Math.round((side - cut.width) / 2);
  const baseY = Math.round(side * (style === "studio" ? 0.8 : 0.84)); // base du produit
  return { side, left, baseY, top: baseY - cut.height };
}

export async function composeMontage(cut: CutoutProduct, style: MontageStyle): Promise<Buffer> {
  const { side, left, baseY, top } = montageLayout(cut, style);
  const horizon = style === "studio" ? baseY - Math.round(cut.height * 0.06) : Math.round(side * 0.66);

  const background =
    style === "studio"
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}">
          <defs>
            <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fdfdfd"/><stop offset="1" stop-color="#e6e7ea"/></linearGradient>
            <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dfe1e5"/><stop offset="1" stop-color="#f6f6f7"/></linearGradient>
            <radialGradient id="spot" cx="0.5" cy="0.38" r="0.6"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
            <filter id="soft"><feGaussianBlur stdDeviation="${side * 0.01}"/></filter>
          </defs>
          <rect width="${side}" height="${horizon}" fill="url(#wall)"/>
          <rect y="${horizon}" width="${side}" height="${side - horizon}" fill="url(#floor)"/>
          <rect y="${horizon - side * 0.02}" width="${side}" height="${side * 0.04}" fill="#e3e4e8" filter="url(#soft)" opacity="0.6"/>
          <rect width="${side}" height="${side}" fill="url(#spot)"/>
        </svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}">
          <defs>
            <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#faf7f2"/><stop offset="1" stop-color="#ece5da"/></linearGradient>
            <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9bd98"/><stop offset="1" stop-color="#c9a77f"/></linearGradient>
            <filter id="grain" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="${(1.5 / side).toFixed(5)} ${(90 / side).toFixed(5)}" numOctaves="4" seed="7"/>
              <feColorMatrix type="matrix" values="0 0 0 0 0.40  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 1.4 -0.35"/>
            </filter>
            <linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
            <radialGradient id="light" cx="0.5" cy="0.3" r="0.7"><stop offset="0" stop-color="#fff" stop-opacity="0.35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
          </defs>
          <rect width="${side}" height="${horizon}" fill="url(#wall)"/>
          <rect y="${horizon}" width="${side}" height="${side - horizon}" fill="url(#wood)"/>
          <rect y="${horizon}" width="${side}" height="${side - horizon}" filter="url(#grain)" opacity="0.85"/>
          <rect y="${horizon}" width="${side}" height="${side * 0.03}" fill="url(#edge)"/>
          <rect width="${side}" height="${side}" fill="url(#light)"/>
        </svg>`;

  const layers: OverlayOptions[] = [];
  if (style === "studio") {
    // Reflet : produit retourné, de plus en plus transparent (seule déformation : la symétrie, sur le SOL).
    const reflectH = Math.min(cut.height, Math.round(cut.height * 0.45));
    const fade = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${cut.width}" height="${cut.height}">
        <defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="${(reflectH / cut.height).toFixed(3)}" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
        <rect width="${cut.width}" height="${cut.height}" fill="url(#f)"/>
      </svg>`,
    );
    const reflection = await sharp(cut.png).flip().composite([{ input: fade, blend: "dest-in" }]).png().toBuffer();
    const visible = Math.min(cut.height, side - baseY);
    if (visible > 0) {
      const cropped = await sharp(reflection).extract({ left: 0, top: 0, width: cut.width, height: visible }).blur(1.2).toBuffer();
      layers.push({ input: cropped, left, top: baseY });
    }
  }
  layers.push({ input: contactShadow(side, side, side / 2, baseY, cut.width, cut.height, style === "table" ? 0.32 : 0.22), left: 0, top: 0 });
  layers.push({ input: cut.png, left, top });

  return sharp(Buffer.from(background)).composite(layers).flatten({ background: "#ffffff" }).png().toBuffer();
}

/** Photo d'origine → PNG fond blanc (raccourci : détourage + composeWhite). */
export async function studioFromCutout(original: Buffer): Promise<Buffer> {
  return composeWhite(await cutoutProduct(original));
}
