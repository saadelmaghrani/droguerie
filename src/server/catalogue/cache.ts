// Cache du site public : toutes les lectures du catalogue portent l'étiquette CATALOGUE_TAG.
// Chaque action d'administration qui modifie produits, photos, catégories, numéros WhatsApp
// ou paramètres appelle invalidateCatalogue() : le site public est à jour immédiatement.
import "server-only";

import { updateTag } from "next/cache";

export const CATALOGUE_TAG = "catalogue";

/** À appeler dans une action serveur, après une modification réussie. */
export function invalidateCatalogue(): void {
  updateTag(CATALOGUE_TAG);
}
