// Coûts IA affichés à l'admin AVANT de lancer la génération (ordres de grandeur, prix publics OpenAI).
// Le plafond du site (src/server/ai/budget.ts) utilise des estimations plus prudentes.
// Logique pure : serveur + navigateur. Testée par ai-costs.test.ts.

export const TYPICAL_COST_USD = {
  /** Nom + description par le petit modèle « vision » (photo 800 px + texte). */
  text: 0.001,
  /** Une mise en scène IA (OpenAI images.edit, qualité « medium »). */
  aiScene: 0.05,
} as const;

export type ExtraKind = "montage" | "ai";
export const EXTRA_COUNTS = [0, 1, 2] as const;
export type ExtraCount = (typeof EXTRA_COUNTS)[number];

/** Coût estimé d'une génération : texte (si OpenAI est configuré) + mises en scène IA éventuelles. */
export function estimateGenerationUsd(options: { extraCount: ExtraCount; extraKind: ExtraKind; openAiConfigured: boolean }): number {
  if (!options.openAiConfigured) return 0;
  const scenes = options.extraKind === "ai" ? options.extraCount : 0;
  return TYPICAL_COST_USD.text + scenes * TYPICAL_COST_USD.aiScene;
}

/** « gratuit », « ≈ 0,001 $ », « ≈ 0,10 $ » (2 chiffres significatifs au-delà d'un centime). */
export function formatUsd(amount: number): string {
  if (amount === 0) return "gratuit";
  const digits = amount < 0.01 ? 3 : 2;
  return `≈ ${amount.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits })} $`;
}
