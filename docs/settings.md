# Paramètres du magasin

Page d'administration : `/admin/parametres`. Une seule ligne en base (`store_settings`, `id = 1`).
**Un champ laissé vide est enregistré `NULL` et le bloc correspondant est masqué sur le site.**

## Champs et validation

| Section | Champ | Règle |
|---|---|---|
| Identité | Nom du magasin | Obligatoire, 2 à 60 caractères |
| | Couleur principale | `#RRGGBB` ; texte des boutons blanc ou foncé calculé automatiquement (contraste WCAG, `src/lib/color.ts`) |
| Bannière | Titre / sous-titre / texte du bouton | 80 / 200 / 30 caractères |
| Infos pratiques | Présentation, adresse, horaires | 2000 / 200 / 300 caractères |
| | Téléphone | Même conversion que WhatsApp (`src/lib/phone.ts`) |
| | Email | Format email |
| | Carte Google Maps | Code `<iframe>` ou lien acceptés ; **seule l'adresse `https://www.google.com/maps/embed…` est conservée** (`src/lib/external-links.ts`) |
| Réseaux sociaux | Facebook, Instagram, TikTok | Facultatifs ; https + domaine du réseau obligatoires |
| Google | Titre / description | 70 / 160 caractères (limites d'affichage Google) |
| Accueil | « Mis en avant », « Nouveautés » | Interrupteurs |

## Sécurité

- On ne stocke **jamais** de HTML fourni par l'admin : le code `<iframe>` collé est réduit à son
  adresse, validée (https, domaine Google, chemin `/maps/embed`). Le site générera lui-même l'iframe.
- Les liens sociaux sont vérifiés (domaine exact ou sous-domaine : `facebook.com.evil.com` est refusé).
- L'action `saveStoreSettings` appelle `requireAdmin()` en premier (testé par appel direct).

## Point technique : formulaires et React 19

Les formulaires admin à champs contrôlés (catégories, paramètres) sont envoyés avec
`onSubmit={submitWithoutReset(formAction)}` (`src/lib/forms.ts`) et non `action={formAction}`.
Avec `action`, React 19 réinitialise le formulaire après l'envoi : les interrupteurs et listes Radix
revenaient alors à leur valeur de départ (bug constaté et couvert par des tests de non-régression).

## À venir

Logo et image de bannière : avec l'envoi d'images (semaine 3).
