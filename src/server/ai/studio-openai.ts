// Photo « fond studio » par OpenAI (option payante). ATTENTION : le modèle REDESSINE l'image ;
// malgré la consigne stricte ci-dessous, une inscription ou un logo peut être altéré.
// C'est pourquoi l'interface l'indique et impose la comparaison avant/après.
import "server-only";

import { toFile } from "openai";
import sharp from "sharp";
import { openai } from "./client";
import { AiError } from "./errors";

export const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-2.5-sunburst";

export function aiImageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_OPENAI_IMAGE_MODEL;
}

export const STUDIO_PROMPT = `Product photo retouching for an online catalogue. Edit this photo:
- Replace ONLY the background with a seamless, uniform very light grey studio backdrop (#F4F4F5), soft even lighting,
  and a subtle natural contact shadow under the product.
- Center the product with even margins; the whole product must stay visible and uncropped.
STRICT RULES — the product itself must remain exactly as in the original photo:
- Do not change its shape, proportions, colours, materials, brand, logo, label, printed text, numbers, or packaging.
- Do not add, remove, translate, retype or "correct" any text or detail. Do not add props, hands, reflections or new objects.
- If something on the product is blurry or unreadable, leave it as it is; never invent it.`;

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

export async function studioFromOpenAi(original: Buffer): Promise<{ png: Buffer; model: string; inputTokens: number; outputTokens: number }> {
  const model = aiImageModel();
  const client = openai(); // lève not_configured si la clé est absente
  const input = await sharp(original).autoOrient().resize(1536, 1536, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
  const response = await client.images.edit(
    {
      model,
      image: await toFile(input, "produit.png", { type: "image/png" }),
      prompt: STUDIO_PROMPT,
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
