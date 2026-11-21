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

## Aperçu avant publication

Page `/admin/produits/<id>/apercu` (bouton « Aperçu » de la fiche, ou menu « ⋯ » de la liste).

- Montre la fiche **exactement comme sur le site** : le même composant
  `src/components/catalogue/product-detail.tsx` servira à la page publique `/produits/<adresse>`.
- Affiche la version **enregistrée** : dans la fiche, le bouton « Aperçu » est désactivé tant
  qu'il reste des modifications non enregistrées.
- Bandeau : « Visible sur le site » ou non, avec les raisons (`src/lib/product-visibility.ts`) :

| Raison | Effet |
|---|---|
| Statut Brouillon ou Masqué | Bloquant : absent du site |
| Catégorie masquée | Bloquant : absent du site |
| Aucune photo | Avertissement : image neutre affichée |
| Pas de description | Avertissement |
| Aucun numéro WhatsApp actif | Avertissement : pas de bouton de contact |

- Bouton « Publier » directement depuis l'aperçu.
- Bouton WhatsApp : numéro de la catégorie s'il est actif, sinon le numéro par défaut ;
  message prérempli « Bonjour, je souhaite connaître le prix et la disponibilité de : <nom> (réf. <référence>) ».

## Code

| Fichier | Rôle |
|---|---|
| `src/server/products/service.ts` | Recherche SQL, règles métier, accès base |
| `src/server/products/actions.ts` | Actions serveur : `requireAdmin()` → zod → service → `refresh()` |
| `src/lib/product-status.ts` | Libellés des statuts et correspondance avec l'URL |
| `src/server/products/preview.ts` | Données de la fiche publique (photos, numéro WhatsApp résolu) |
| `src/lib/product-visibility.ts` | Numéro WhatsApp, message prérempli, raisons de non-visibilité (testé) |
| `src/components/catalogue/` | Fiche produit et galerie du site (réutilisées par l'aperçu) |
| `src/app/admin/(protected)/produits/` | Liste, filtres, tableau, fiche (création / modification), aperçu |

## À venir

Import CSV : tâche 12 (suite). Photos : voir `docs/images.md`.
