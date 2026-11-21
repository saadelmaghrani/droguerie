// Photos SUPPLÉMENTAIRES par OpenAI (images.edit) : 2 mises en scène de la photo envoyée.
// ATTENTION : le modèle REDESSINE l'image. Pour limiter l'invention, on ne demande PAS d'autres angles
// (l'IA devrait alors imaginer les faces cachées) : seulement la MÊME face visible, dans un autre décor.
// L'interface les présente comme « générées par l'IA », décochées par défaut.
import "server-only";

import { toFile } from "openai";
import sharp from "sharp";
import { openai } from "./client";
import { AiError } from "./errors";

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

/** Deux mises en scène sobres, adaptées à un catalogue de droguerie. */
export const SCENE_PROMPTS = [
  `Catalogue photo of this product placed on a clean light wooden tabletop, against a softly blurred, bright neutral background
(well-lit shop or workshop ambience). Natural soft daylight, realistic shadow, product centered and in sharp focus.
${STRICT_RULES}`,
  `Premium studio photo of this product on a seamless soft light-grey to white gradient backdrop with a subtle glossy floor
reflection and gentle rim lighting. Product centered, slightly larger in frame, in sharp focus.
${STRICT_RULES}`,
] as const;

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
): Promise<{ png: Buffer; model: string; inputTokens: number; outputTokens: number }> {
  const model = aiImageModel();
  const client = openai(); // lève not_configured si la clé est absente
  const input = await sharp(original).autoOrient().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const response = await client.images.edit(
    {
      model,
      image: await toFile(input, "produit.png", { type: "image/png" }),
      prompt: SCENE_PROMPTS[index],
      size: "1024x1024",
      quality: "high",
      background: "opaque",
      output_format: "png",
    },
    { timeout: 180_000 }, // une génération d'image peut prendre plus d'une minute
  );
  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new AiError("bad_response", "aucune image renvoyée");
  return {
    png: Buffer.from(b64, "base64"),
    model,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}
