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

## Photo principale obligatoire (décision du 21/11/2026)

| Situation | Règle |
|---|---|
| Nouveau produit (formulaire, manuel ou IA) | Au moins une photo avant « Créer le produit » (bloqué dans le formulaire) |
| Passer en « Publié » (fiche, liste, aperçu) | **Refusé sans photo principale** par le serveur : « Ajoutez une photo principale pour publier ce produit. » |
| Création avec statut « Publié » | Créé en brouillon, puis publié automatiquement une fois la photo envoyée |
| Produit **déjà publié** sans photo (antérieur à la règle) | Reste publié et modifiable ; le site affiche une **image par défaut** (pictogramme de sa catégorie, « Photo à venir ») |
| Import CSV « Publié » sans photo | Nouveau produit → importé **en brouillon** ; produit existant non publié sans photo → statut inchangé ; annoncé dans l'analyse |

Règle : `publishBlockedReason` (`src/lib/product-visibility.ts`, testé), appliquée dans
`updateProduct` / `setProductStatus` / `createProduct` (`service.ts`) et `validateImportRows`.
Suivi : filtre « Sans photo » de la liste (`?photo=sans`) et alerte sur le tableau de bord
(« N produits publiés sans photo »).
Supprimer la dernière photo d'un produit publié est permis : il passe alors à l'image par défaut.

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
| Aucune photo | Publié : avertissement (image par défaut) ; non publié : **bloquant** (photo obligatoire pour publier) |
| Pas de description | Avertissement |
| Aucun numéro WhatsApp actif | Avertissement : pas de bouton de contact |

- Bouton « Publier » directement depuis l'aperçu.
- Bouton WhatsApp : numéro de la catégorie s'il est actif, sinon le numéro par défaut ;
  message prérempli « Bonjour, je souhaite connaître le prix et la disponibilité de : <nom> (réf. <référence>) ».

## Import CSV

Page `/admin/produits/import` (bouton « Importer » de la liste). Modèle : `/admin/produits/import/modele`.

1. **Analyse** : le fichier est lu et vérifié, **rien n'est enregistré**. Écran : nombre de créations,
   de mises à jour et de lignes en erreur (avec numéro de ligne Excel et explication).
2. **Import** : le navigateur renvoie le même fichier ; le serveur le ré-analyse puis écrit toutes les
   lignes valides en **une transaction** (tout ou rien). Les lignes en erreur sont ignorées.

| Règle | Détail |
|---|---|
| Format | CSV « ; », « , » ou tabulation (détecté) ; UTF-8 ou Windows-1252 (Excel français) ; 5 Mo et 5000 lignes max |
| Colonnes | Reconnues sans accents ni majuscules : Nom, Catégorie, Description, Référence, Marque, Statut, Mis en avant. Autres colonnes ignorées (signalées) |
| Prix | Une colonne Prix/Tarif est signalée et **jamais lue** |
| Création | Nom et Catégorie obligatoires ; Statut par défaut : Brouillon ; adresse générée (suffixe -2, -3… si déjà prise) |
| Mise à jour | Si la **Référence** existe déjà (majuscules ignorées). Case vide = valeur inchangée. L'adresse et la référence ne sont jamais modifiées |
| Catégorie | Nom ou adresse d'une catégorie existante (accents/majuscules ignorés). Une catégorie inconnue n'est pas créée : erreur |
| Référence en double dans le fichier | Erreur sur les lignes suivantes |
| Photos | Non importées : à ajouter depuis chaque fiche |

Mesuré en local : 2000 lignes analysées en 0,2 s, importées en 0,8 s.

## Code

| Fichier | Rôle |
|---|---|
| `src/server/products/service.ts` | Recherche SQL, règles métier, accès base |
| `src/server/products/actions.ts` | Actions serveur : `requireAdmin()` → zod → service → `refresh()` |
| `src/lib/product-status.ts` | Libellés des statuts et correspondance avec l'URL |
| `src/server/products/preview.ts` | Données de la fiche publique (photos, numéro WhatsApp résolu) |
| `src/lib/product-visibility.ts` | Numéro WhatsApp, message prérempli, raisons de non-visibilité (testé) |
| `src/lib/csv.ts` | Lecture CSV (séparateur, encodage, guillemets) et écriture (testé) |
| `src/lib/product-import.ts` | Colonnes et validation des lignes importées (testé) |
| `src/server/products/import.ts`, `import-actions.ts` | Analyse et import en transaction |
| `src/components/catalogue/` | Fiche produit et galerie du site (réutilisées par l'aperçu) |
| `src/app/admin/(protected)/produits/` | Liste, filtres, tableau, fiche (création / modification), aperçu |

## À venir

Photos : voir `docs/images.md`.
