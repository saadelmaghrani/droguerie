# Produits

Pages d'administration : `/admin/produits` (liste), `/admin/produits/nouveau`, `/admin/produits/<id>`.

## Liste

- **Recherche** (`?q=`) : nom, description, marque, référence. Combine
  1. la recherche plein texte française (pluriels, sans accents) — index `products_search_fts_idx` ;
  2. la tolérance aux fautes de frappe sur un mot du nom (`<%`) — index `products_name_trgm_idx` ;
  3. le début de la référence (`ref-peint` → `REF-PEINT-010`).
  Résultats triés par pertinence, puis par date de modification.
- **Filtres** : `?categorie=<id>` et `?statut=brouillon|publie|masque` (envoi automatique au changement).
- **Pagination** : 20 produits par page (`?page=2`). Seule la page demandée est lue en base.
- Les filtres sont dans l'URL (composant `<Form>` de Next.js) : lien partageable, bouton retour fonctionnel.
- **Actions rapides** : étoile (mise en avant), publier, repasser en brouillon, masquer, supprimer.

## Fiche produit

| Champ | Règle |
|---|---|
| Nom | 2 à 120 caractères (les doublons de nom sont permis) |
| Adresse (slug) | Générée depuis le nom. **Création** : si elle existe déjà, suffixe automatique `-2`, `-3`… **Modification** : un doublon est refusé. |
| Description | 5000 caractères max |
| Référence | Facultative ; **unique sans tenir compte des majuscules** |
| Marque | Facultative, 60 caractères |
| Catégorie | Obligatoire (les catégories masquées sont proposées, avec avertissement) |
| Statut | Brouillon (défaut) / Publié / Masqué |
| Mis en avant | Section « Produits mis en avant » de l'accueil |

- `published_at` : renseignée au **premier** passage en « Publié », puis conservée (tri des « Nouveautés »).
- Avertissements : produit publié sans photo ; produit publié dans une catégorie masquée.
- **Aucun champ prix** (exigence du cahier des charges).

## Code

| Fichier | Rôle |
|---|---|
| `src/server/products/service.ts` | Recherche SQL, règles métier, accès base |
| `src/server/products/actions.ts` | Actions serveur : `requireAdmin()` → zod → service → `refresh()` |
| `src/lib/product-status.ts` | Libellés des statuts et correspondance avec l'URL |
| `src/app/admin/(protected)/produits/` | Liste, filtres, tableau, fiche (création / modification) |

## À venir

Aperçu avant publication et import CSV : tâche 12. Photos : voir `docs/images.md`.
