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
import sharp from "sharp";
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

/** Photo d'origine (n'importe quel format lisible) → PNG fond studio, produit à l'échelle 1:1. */
export async function studioFromCutout(original: Buffer): Promise<Buffer> {
  const { data: rgb, info } = await sharp(original).autoOrient().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const alpha = refineAlpha(await cutoutMask(rgb, width, height));
  const box = alphaBounds(alpha, width, height);
  if (!box) throw new AiError("no_subject");

  // Produit découpé : pixels RGB d'origine + transparence du détourage, SANS redimensionnement.
  // Deux étapes : dans une même chaîne sharp, extract() serait appliqué AVANT joinChannel() (et ignoré).
  const rgba = await sharp(rgb, { raw: { width, height, channels: 3 } })
    .joinChannel(alpha, { raw: { width, height, channels: 1 } })
    .raw()
    .toBuffer();
  const product = await sharp(rgba, { raw: { width, height, channels: 4 } }).extract(box).png().toBuffer();

  const side = Math.max(Math.ceil(Math.max(box.width, box.height) / FILL_RATIO), 400);
  const left = Math.round((side - box.width) / 2);
  const top = Math.round((side - box.height) / 2);

  // Ombre douce sous le produit (ellipse floue), pour un rendu « studio » posé.
  const shadowW = Math.round(box.width * 0.85);
  const shadowH = Math.max(8, Math.round(box.height * 0.05));
  const shadow = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${side}">
      <defs><filter id="b"><feGaussianBlur stdDeviation="${Math.max(4, shadowH / 2)}"/></filter></defs>
      <ellipse cx="${side / 2}" cy="${top + box.height - shadowH * 0.3}" rx="${shadowW / 2}" ry="${shadowH / 2}"
        fill="#000" fill-opacity="0.16" filter="url(#b)"/>
    </svg>`,
  );

  return sharp({ create: { width: side, height: side, channels: 3, background: STUDIO_BACKGROUND } })
    .composite([
      { input: shadow, left: 0, top: 0 },
      { input: product, left, top },
    ])
    .png()
    .toBuffer();
}
