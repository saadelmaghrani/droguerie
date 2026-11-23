// Le produit est-il vendu en LOT (plusieurs articles sur la photo, voulus) ? D'après son nom / les notes.
// Sinon, le traitement photo isole UN seul exemplaire quand plusieurs copies identiques sont visibles.
// Logique pure : serveur + navigateur. Testée par multi-pack.test.ts.

const PACK_PATTERNS = [
  /\b(lots?|packs?|kits?|jeux|jeu|sets?|coffrets?|assortiments?|paquets?|bo[iî]tes? de|sachets? de|paires?|duo|trio)\b/i,
  // x10, x 3 — mais pas une dimension (« 5 m x 19 mm », « 20x200 mm »).
  /(?:^|\s)x\s?\d+\b(?!\s?(mm|cm|m|m[eè]tres?|po|pouces|kg|g|l|ml|v|w)\b)/i,
  /\b\d+\s?x\b(?!\s?\d)/i, // 3x
  /\b\d+\s?(pcs|pc|pi[eè]ces?|unit[ée]s?)\b/i, // 19pcs, 10 pièces
];

export function isMultiPack(...texts: (string | null | undefined)[]): boolean {
  const text = texts.filter(Boolean).join(" ");
  return PACK_PATTERNS.some((pattern) => pattern.test(text));
}
