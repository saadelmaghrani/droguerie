// Statuts des produits : libellés français et correspondance avec l'URL (?statut=publie).
// Logique pure : serveur + navigateur.

export const PRODUCT_STATUSES = ["DRAFT", "PUBLISHED", "HIDDEN"] as const;
export type ProductStatusValue = (typeof PRODUCT_STATUSES)[number];

export const STATUS_INFO: Record<ProductStatusValue, { label: string; description: string; url: string }> = {
  DRAFT: { label: "Brouillon", description: "Visible uniquement dans l'administration.", url: "brouillon" },
  PUBLISHED: { label: "Publié", description: "Visible sur le site.", url: "publie" },
  HIDDEN: { label: "Masqué", description: "Retiré du site sans être supprimé.", url: "masque" },
};

/** « publie » → "PUBLISHED" ; valeur inconnue → null (pas de filtre). */
export function statusFromUrl(value: string | undefined): ProductStatusValue | null {
  return PRODUCT_STATUSES.find((s) => STATUS_INFO[s].url === value) ?? null;
}
