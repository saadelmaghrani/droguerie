// Couleurs : validation #RRGGBB et lisibilité du texte posé dessus (WCAG 2.x).
// Logique pure : utilisée côté serveur et navigateur (aperçu en direct).

export const DEFAULT_PRIMARY_COLOR = "#334155";

export function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Luminance relative (0 = noir, 1 = blanc) selon la formule WCAG. */
export function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** Rapport de contraste entre deux couleurs (1 à 21). 4,5 minimum recommandé pour du texte. */
export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (l1! + 0.05) / (l2! + 0.05);
}

/** Couleur de texte (blanc ou quasi-noir) la plus lisible sur un fond donné. */
export function readableTextColor(background: string): "#ffffff" | "#0f172a" {
  return contrastRatio(background, "#ffffff") >= contrastRatio(background, "#0f172a") ? "#ffffff" : "#0f172a";
}
