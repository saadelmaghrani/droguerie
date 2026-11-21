# Site public

Pages (groupe de routes `src/app/(site)/`, mobile d'abord) :

| Adresse | Contenu |
|---|---|
| `/` | Bannière + recherche, catégories (tuiles), produits mis en avant, nouveautés, contact WhatsApp, présentation / plan |
| `/produits?q=…&page=…` | Catalogue : recherche, pastilles de catégories (défilantes sur mobile), grille 2 → 3 → 4 colonnes, 24 par page |
| `/categories/<adresse>?q=…` | Même catalogue limité à une catégorie (recherche comprise) |
| `/produits/<adresse>` | Fiche produit — étape suivante |

En-tête (logo, recherche, bouton Catalogue, menu ☰ des catégories sur mobile) et pied de page
(coordonnées, catégories, WhatsApp, réseaux) : `src/components/site/`. Un champ vide dans les Paramètres
masque le bloc correspondant. Couleur principale des Paramètres : variables CSS `--brand` /
`--brand-foreground` (texte lisible calculé).

## Règle de visibilité

Produit visible ⇔ **Publié** ET **catégorie visible**. Appliquée dans chaque requête de
`src/server/catalogue/queries.ts` : accueil, catalogue, recherche, menus, et adresse directe
(catégorie masquée ou vide → page introuvable). Les catégories sans produit visible ne sont pas listées.

## Recherche

Même moteur que l'admin (plein texte français sans accents, fautes de frappe sur le nom, début de
référence), limité aux produits visibles. Exemples testés : « peintur », « eponge », « detergant ».

## Cache

- Lectures publiques : `"use cache"` + `cacheTag("catalogue")` + `cacheLife("max")`.
- Toute action d'administration qui modifie le catalogue appelle `invalidateCatalogue()`
  (`src/server/catalogue/cache.ts`, `updateTag`) : le site est à jour immédiatement.
- `connection()` dans les pages : rendu à la demande, jamais pendant `next build`
  (la base n'est pas accessible lors de la construction de l'image Docker).
- ⚠️ Une modification faite **directement en base** (SQL, Prisma Studio) n'apparaît sur le site qu'après
  la prochaine modification dans l'admin ou un redémarrage.

## Images

Balises `<img>` avec `srcset` des tailles déjà générées (320 / 800 / 1600) : le téléphone charge la
petite image. Chargement différé hors écran.
