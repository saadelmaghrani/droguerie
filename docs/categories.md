# Catégories

Page d'administration : `/admin/categories`. Un seul niveau (pas de sous-catégories).

## Champs

| Champ | Règle |
|---|---|
| Nom | 2 à 60 caractères, unique **sans tenir compte des majuscules** |
| Adresse (slug) | `/categories/<slug>` : minuscules, chiffres, tirets ; unique ; 80 caractères max |
| Description | Facultative, 500 caractères max |
| Pictogramme | Icône affichée dans le menu mobile, les pastilles du catalogue et les tuiles de l'accueil. « Automatique » (par défaut) = suggérée d'après le nom (`src/lib/category-icons.tsx`, testé) ; sinon choisie parmi ~50 icônes de droguerie |
| Numéro WhatsApp | Un numéro précis, ou « numéro par défaut » (`whatsapp_number_id` = NULL) |
| Visible sur le site | Interrupteur (`is_active`) |
| Ordre | Boutons ↑ ↓ (`sort_order`, renuméroté 0, 1, 2… à chaque déplacement) |

## Règles métier

| Règle | Où |
|---|---|
| Adresse générée depuis le nom à la création ; **conservée** au renommage (avertissement si modifiée à la main) | Formulaire |
| Nouvelle catégorie placée en fin de liste | `createCategory` |
| Suppression **refusée** si la catégorie contient des produits | `deleteCategory` + base (`ON DELETE RESTRICT`) + menu grisé |
| Catégorie masquée → **elle et tous ses produits** disparaissent du site (listes, recherche, adresse directe) | `src/server/catalogue/queries.ts` (testé) |
| Numéro associé désactivé → le numéro par défaut est utilisé (avertissement affiché) | Résolution WhatsApp (voir `docs/whatsapp.md`) |

## Code

| Fichier | Rôle |
|---|---|
| `src/lib/slug.ts` | `slugify`, `isValidSlug` (testés par `slug.test.ts`) |
| `src/server/categories/service.ts` | Règles métier et accès base |
| `src/server/categories/actions.ts` | Actions serveur : `requireAdmin()` → zod → service → `refresh()` |
| `src/app/admin/(protected)/categories/` | Page, liste, formulaire, confirmation |

## Catégories créées automatiquement (IA)

Sur « Nouveau produit », l'IA peut proposer une nouvelle catégorie si aucune existante ne correspond ; elle est
créée à l'enregistrement du produit (fin de liste, visible, adresse unique) et se gère ensuite comme les autres.
Détails : `docs/ai.md` › « Catégorie automatique ».
