// Fiche produit côté site : numéro WhatsApp à utiliser, message prérempli et raisons pour
// lesquelles un produit n'est pas (ou mal) visible. Logique pure : serveur + navigateur.
import type { ProductStatusValue } from "./product-status";

type WhatsappCandidate = { phone: string; isActive: boolean } | null | undefined;

/**
 * Numéro WhatsApp d'un produit (voir docs/whatsapp.md) :
 * 1. celui de sa catégorie, s'il existe et est actif ;
 * 2. sinon le numéro par défaut (toujours actif) ;
 * 3. sinon aucun (aucun numéro configuré).
 */
export function pickWhatsappPhone(categoryNumber: WhatsappCandidate, defaultNumber: WhatsappCandidate): string | null {
  if (categoryNumber?.isActive) return categoryNumber.phone;
  if (defaultNumber?.isActive) return defaultNumber.phone;
  return null;
}

/**
 * Message prérempli envoyé au magasin depuis la fiche produit.
 * Le lien de la fiche (si l'adresse du site est connue) permet au vendeur d'identifier le produit exact.
 */
export function productWhatsappMessage(productName: string, reference?: string | null, productUrl?: string | null): string {
  const ref = reference?.trim() ? ` (réf. ${reference.trim()})` : "";
  const link = productUrl ? `\n${productUrl}` : "";
  return `Bonjour, je souhaite connaître le prix et la disponibilité de : ${productName}${ref}${link}`;
}

export type VisibilityIssue = {
  /** blocking : le produit n'apparaît pas sur le site. warning : il apparaît, mais incomplet. */
  level: "blocking" | "warning";
  message: string;
};

export function productVisibilityIssues(p: {
  status: ProductStatusValue;
  categoryName: string;
  categoryActive: boolean;
  imageCount: number;
  hasWhatsapp: boolean;
  hasDescription: boolean;
}): VisibilityIssue[] {
  const issues: VisibilityIssue[] = [];
  if (p.status === "DRAFT") issues.push({ level: "blocking", message: "Brouillon : ce produit n'est pas encore visible sur le site." });
  if (p.status === "HIDDEN") issues.push({ level: "blocking", message: "Masqué : ce produit est retiré du site." });
  if (!p.categoryActive) {
    issues.push({
      level: "blocking",
      message: `La catégorie « ${p.categoryName} » est masquée : ses produits ne sont pas visibles sur le site.`,
    });
  }
  if (p.imageCount === 0) {
    issues.push(
      p.status === "PUBLISHED"
        ? { level: "warning", message: "Aucune photo : le site affiche une image par défaut (pictogramme de la catégorie)." }
        : { level: "blocking", message: "Photo principale obligatoire pour publier ce produit." },
    );
  }
  if (!p.hasDescription) issues.push({ level: "warning", message: "Pas de description." });
  if (!p.hasWhatsapp) {
    issues.push({
      level: "warning",
      message: "Aucun numéro WhatsApp actif : le bouton de contact ne sera pas affiché.",
    });
  }
  return issues;
}

/** Message affiché quand on tente de publier un produit sans photo principale. */
export const PHOTO_REQUIRED_TO_PUBLISH = "Ajoutez une photo principale pour publier ce produit.";

/**
 * Règle « photo obligatoire » (décision du 21/11/2026) :
 *  - PASSER en « Publié » exige une photo principale ;
 *  - un produit DÉJÀ publié sans photo (antérieur à la règle) reste publié : le site affiche
 *    une image par défaut (pictogramme de sa catégorie) jusqu'à l'ajout d'une photo.
 * Renvoie le message d'erreur, ou null si le changement est permis.
 */
export function publishBlockedReason(p: { currentStatus: ProductStatusValue | null; nextStatus: ProductStatusValue; hasPhoto: boolean }): string | null {
  if (p.nextStatus !== "PUBLISHED" || p.hasPhoto || p.currentStatus === "PUBLISHED") return null;
  return PHOTO_REQUIRED_TO_PUBLISH;
}
