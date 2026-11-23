// Photos SUPPLÉMENTAIRES par OpenAI (images.edit), « Générées par l'IA ». Par défaut sur FOND BLANC PUR
// (#FFFFFF, produit centré et net) ; décor (table, studio dégradé) seulement si l'admin le choisit.
// ATTENTION : le modèle REDESSINE l'image. Pour limiter l'invention, on ne demande PAS d'autres angles
// (l'IA devrait alors imaginer les faces cachées) : seulement la MÊME face visible, dans un autre décor.
// L'interface les présente comme « générées par l'IA », décochées par défaut.
import "server-only";

import { toFile } from "openai";
import sharp from "sharp";
import type { SceneBackground } from "@/lib/ai-costs";
import { openai } from "./client";
import { AiError } from "./errors";
import { composeWhite, cutoutProduct } from "./studio-cutout";

export const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-2.5-sunburst";

export function aiImageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_OPENAI_IMAGE_MODEL;
}

const STRICT_RULES = `STRICT RULES — the product must remain exactly as in the original photo:
- Show the SAME visible side of the product as in the original. Never show a side, back or top that is not visible in the original.
- Do not change its shape, proportions, colours, materials, brand, logo, label, printed text, numbers, or packaging.
- Do not add, remove, translate, retype or "correct" any text or detail. Do not add other products, hands, people or brand names.
- If something on the product is blurry or unreadable, leave it as it is; never invent it.
- The whole product stays visible and uncropped. No text overlay, no watermark.`;

/**
 * UN SEUL ARTICLE (par défaut) : en magasin, le produit est souvent photographié en présentoir (plusieurs
 * exemplaires suspendus ou alignés les uns derrière les autres). La fiche vend UN article : on ne garde que
 * l'exemplaire de devant. Exception : produit vendu en lot / pack (isMultiPack, d'après le nom et les notes).
 */
export const SINGLE_ITEM_RULE = `QUANTITY: show exactly ONE single unit of the product. If the photo shows several identical units —
stacked, hanging on a display hook, overlapping, or lined up behind each other — keep only the front-most, most complete unit and
remove all the other units entirely (no partial copies, no extra handles, edges, tags or packaging of the other units behind it).
The kept unit must remain identical to the original (same packaging, label and details).`;
export const PACK_RULE = `QUANTITY: this product is sold as a set / pack: keep every item that belongs to the set, exactly as shown.`;

/**
 * PAR DÉFAUT : photo « packshot » sur blanc pur, comme la photo principale. Deux variantes d'éclairage,
 * même cadrage. Aucun décor (atelier, table, sol), aucun fond coloré ou dégradé.
 */
const WHITE_BACKGROUND = `BACKGROUND: pure white #FFFFFF everywhere around the product — seamless, flat and uniform.
No workshop, no table or floor surface, no horizon line, no wall, no props, no gradient, no vignette, no coloured or grey backdrop,
no reflection. Only a very soft, light contact shadow directly under the product is allowed.
FRAMING: product perfectly centered, fully visible and uncropped, filling about three quarters of the frame with even white margins
on all sides. Product in sharp focus, crisp edges, true-to-life colours.`;

export const WHITE_PROMPTS = [
  `Professional e-commerce packshot of this product. Bright, even, shadowless studio lighting from the front.
${WHITE_BACKGROUND}
${STRICT_RULES}`,
  `Professional e-commerce packshot of this product. Soft diffused studio lighting from above and both sides that brings out its
shape, materials and the legibility of its printed labels.
${WHITE_BACKGROUND}
${STRICT_RULES}`,
] as const;

/** Seulement si l'admin choisit « Mise en scène » : deux décors sobres pour un catalogue de droguerie. */
export const SCENE_PROMPTS = [
  `Catalogue photo of this product placed on a clean light wooden tabletop, against a softly blurred, bright neutral background
(well-lit shop or workshop ambience). Natural soft daylight, realistic shadow, product centered and in sharp focus.
${STRICT_RULES}`,
  `Premium studio photo of this product on a seamless soft light-grey to white gradient backdrop with a subtle glossy floor
reflection and gentle rim lighting. Product centered, slightly larger in frame, in sharp focus.
${STRICT_RULES}`,
] as const;

export function scenePrompt(index: 0 | 1, background: SceneBackground, singleItem = true): string {
  return `${(background === "scene" ? SCENE_PROMPTS : WHITE_PROMPTS)[index]}\n${singleItem ? SINGLE_ITEM_RULE : PACK_RULE}`;
}

/**
 * Garantie après génération (fond blanc) : l'IA rend souvent un « presque blanc » (#FAFAFA, voile gris).
 * L'image produite est détourée localement puis recadrée exactement comme la photo principale :
 * blanc #FFFFFF, produit centré, 12 % de marge. Si le détourage échoue : fond quasi blanc forcé à #FFFFFF.
 */
export async function enforceWhiteBackground(png: Buffer, singleItem = true): Promise<Buffer> {
  try {
    return await composeWhite(await cutoutProduct(png, { singleItem }));
  } catch {
    return whitenNearWhite(png);
  }
}

/** Pixels quasi blancs (les 3 canaux ≥ 240) → blanc pur ; le reste est inchangé. */
export async function whitenNearWhite(png: Buffer, threshold = 240): Promise<Buffer> {
  const { data, info } = await sharp(png).flatten({ background: "#ffffff" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 3) {
    if (data[i]! >= threshold && data[i + 1]! >= threshold && data[i + 2]! >= threshold) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } }).png().toBuffer();
}

/** Prix publics (dollars / million de jetons) : [entrée, sortie]. Indicatif. */
const IMAGE_PRICES: Record<string, [number, number]> = {
  "gpt-image-2.5-sunburst": [8, 30],
  "gpt-image-2.5-flare": [8, 30],
  "gpt-image-2.6-sunburst": [8, 30],
  "gpt-image-2.6-flare": [8, 30],
};

export function estimateImageCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = IMAGE_PRICES[model];
  if (!price) return 0;
  return Math.round(((inputTokens * price[0] + outputTokens * price[1]) / 1_000_000) * 10_000) / 10_000;
}

export async function sceneFromOpenAi(
  original: Buffer,
  index: 0 | 1,
  background: SceneBackground = "white",
  /** false : lot / pack (tous les articles gardés). */
  singleItem = true,
): Promise<{ png: Buffer; model: string; inputTokens: number; outputTokens: number }> {
  const model = aiImageModel();
  const client = openai(); // lève not_configured si la clé est absente
  const input = await sharp(original).autoOrient().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const response = await client.images.edit(
    {
      model,
      image: await toFile(input, "produit.png", { type: "image/png" }),
      prompt: scenePrompt(index, background, singleItem),
      size: "1024x1024",
      quality: "medium", // ≈ 4 fois moins cher que « high », suffisant pour une vignette catalogue
      background: "opaque",
      output_format: "png",
    },
    { timeout: 180_000 }, // une génération d'image peut prendre plus d'une minute
  );
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new AiError("bad_response", "aucune image renvoyée");
  const generated = Buffer.from(b64, "base64");
  return {
    png: background === "white" ? await enforceWhiteBackground(generated, singleItem) : generated,
    model,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}
