// Nom + description d'un produit par l'IA : consigne, format de réponse, lecture du résultat.
// Sans "server-only" : logique pure, testée par product-text-prompt.test.ts.
import { z } from "zod";

export type ProductTextHints = {
  name: string;
  description: string;
  brand: string;
  reference: string;
  categoryName: string;
};

export const PRODUCT_TEXT_INSTRUCTIONS = `Tu rédiges les fiches produits du catalogue en ligne d'une droguerie de gros au Maroc
(produits d'entretien, peinture, quincaillerie, outillage…). Les clients sont des professionnels et des particuliers.

Règles :
- Français correct, ton professionnel et clair, sans superlatifs creux ni emojis.
- N'invente AUCUNE caractéristique : écris seulement ce qui est visible sur la photo ou donné dans les informations
  (marque, contenance, dimensions, couleur, usage évident). En cas de doute, reste général.
- N'indique jamais de prix, de promotion, de stock ni de délai.
- "name" : nom court et précis, 2 à 120 caractères, avec type de produit, marque si connue, et contenance/taille/quantité
  si visible (ex. « Peinture acrylique blanc mat 10 L »).
- "description" : 2 à 5 phrases (400 à 900 caractères), suivies si utile d'une courte liste de points commençant par « - »
  (usages, conditionnement). Pas de titre, pas de markdown autre que ces tirets.`;

/** Format imposé à la réponse (Structured Outputs, strict). */
export const PRODUCT_TEXT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Nom du produit, 2 à 120 caractères" },
    description: { type: "string", description: "Description commerciale en français" },
  },
  required: ["name", "description"],
  additionalProperties: false,
} as const;

export function buildProductTextPrompt(hints: ProductTextHints, hasPhoto: boolean): string {
  const known = [
    ["Nom actuel", hints.name],
    ["Catégorie", hints.categoryName],
    ["Marque", hints.brand],
    ["Référence", hints.reference],
    ["Description actuelle", hints.description],
  ].filter(([, v]) => v.trim() !== "");
  const lines = known.length
    ? known.map(([label, value]) => `- ${label} : ${value.trim()}`).join("\n")
    : "- (aucune information saisie)";
  return [
    hasPhoto
      ? "Voici la photo du produit et les informations déjà saisies par le magasin."
      : "Aucune photo : appuie-toi uniquement sur les informations déjà saisies par le magasin.",
    "Propose un nom et une description pour la fiche produit.",
    "",
    "Informations saisies :",
    lines,
  ].join("\n");
}

const outputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(1).max(5000),
});

export type ProductTextSuggestion = z.infer<typeof outputSchema>;

/** Texte JSON renvoyé par l'IA → suggestion validée, ou null si inutilisable. */
export function parseProductTextOutput(text: string): ProductTextSuggestion | null {
  try {
    const parsed = outputSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Prix publics en dollars par million de jetons (entrée, sortie). Indicatif : à mettre à jour si OpenAI change ses tarifs. */
const PRICES_PER_MTOK: Record<string, [number, number]> = {
  "gpt-6.2-astra": [8, 40],
  "gpt-6.2-sol": [2, 10],
  "gpt-6.1-terra": [1, 5],
  "gpt-6-luna": [0.1, 0.5],
};

/** Coût estimé d'un appel (0 si le modèle n'est pas dans la table). */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES_PER_MTOK[model];
  if (!price) return 0;
  return Math.round(((inputTokens * price[0] + outputTokens * price[1]) / 1_000_000) * 10_000) / 10_000;
}
