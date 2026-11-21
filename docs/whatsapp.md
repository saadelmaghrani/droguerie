# Numéros WhatsApp

Page d'administration : `/admin/whatsapp`.

## Saisie et stockage

Saisie souple, convertie par `src/lib/phone.ts` (testé par `src/lib/phone.test.ts`) :

| Saisie | Stocké |
|---|---|
| `06 12 34 56 78`, `0612345678`, `06.12.34.56.78` | `212612345678` |
| `+212 6 12 34 56 78`, `+212 06 12 34 56 78`, `00212…`, `212…` | `212612345678` |
| `+33 6 12 34 56 78` (étranger) | `33612345678` |

- Maroc : 9 chiffres après `212`, commençant par 5 (fixe), 6/7 (mobile) ou 8.
- Autres pays : format international, 8 à 15 chiffres.
- Stockage sans « + » : c'est le format attendu par `https://wa.me/<numéro>`.
- Affichage : `formatPhone()` → `+212 6 12 34 56 78`.

## Règles métier

| Règle | Où |
|---|---|
| Un seul numéro « par défaut » | Base (index unique partiel) + `service.ts` (transaction) |
| Le premier numéro créé devient le défaut | `createWhatsappNumber` |
| Le défaut ne peut être ni désactivé ni supprimé (en choisir un autre d'abord) | `service.ts` + menu grisé dans l'interface |
| Définir par défaut un numéro inactif le réactive | `setDefaultWhatsappNumber` |
| Supprimer un numéro utilisé : ses catégories passent au numéro par défaut | Base (`ON DELETE SET NULL`) + message de confirmation |
| Numéro en double refusé | Base (unicité) → message « déjà enregistré » |

## Résolution du numéro d'un produit (site public)

1. Numéro de la catégorie du produit, **s'il existe et est actif** ;
2. sinon, le numéro par défaut.

## Code

| Fichier | Rôle |
|---|---|
| `src/lib/phone.ts` | Conversion, affichage, lien `wa.me` (logique pure, serveur + navigateur) |
| `src/server/whatsapp/service.ts` | Règles métier et accès base |
| `src/server/whatsapp/actions.ts` | Actions serveur : `requireAdmin()` → validation zod → service → `refresh()` |
| `src/app/admin/(protected)/whatsapp/` | Page, liste, formulaire, confirmation |

Les actions serveur sont des points d'entrée HTTP publics : chacune appelle `requireAdmin()` en
premier. Vérifié par un test qui appelle directement les actions sans session et avec un faux jeton.
