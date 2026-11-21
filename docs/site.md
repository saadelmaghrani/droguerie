# Site public

Pages (groupe de routes `src/app/(site)/`, mobile d'abord) :

| Adresse | Contenu |
|---|---|
| `/` | Bannière + recherche, catégories (tuiles), produits mis en avant, nouveautés, contact WhatsApp, présentation / plan |
| `/produits?q=…&page=…` | Catalogue : recherche, pastilles de catégories (défilantes sur mobile), grille 2 → 3 → 4 colonnes, 24 par page |
| `/categories/<adresse>?q=…` | Même catalogue limité à une catégorie (recherche comprise) |
| `/produits/<adresse>` | Fiche produit : galerie, nom, marque, référence, description, bouton WhatsApp, produits de la même catégorie |
| `/sitemap.xml`, `/robots.txt` | Référencement : pages visibles uniquement ; `/admin` interdit aux moteurs |

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

## Fiche produit et WhatsApp

- Composant partagé avec l'aperçu admin : `src/components/catalogue/product-detail.tsx`.
- Bouton « Demander le prix sur WhatsApp » : numéro de la **catégorie** s'il est actif, sinon le numéro
  **par défaut**. Message prérempli : nom (+ référence) + **lien de la fiche** (si `SITE_URL` est renseignée),
  pour que le vendeur identifie le produit exact.
- Mobile : barre WhatsApp **fixée en bas de l'écran**, visible dès l'ouverture de la fiche.
- Brouillon, produit masqué, catégorie masquée, adresse inconnue → « Page introuvable » (avec en-tête,
  balise `noindex`) ; adresse ne correspondant à aucune page → 404.

## Référencement (SEO de base)

- Titre « Produit · Magasin », description (≈ 155 caractères), adresse canonique, image de partage
  (Facebook, WhatsApp…) : `generateMetadata` de chaque page.
- `SITE_URL` (`.env`) : adresse publique du site, indispensable en production pour les liens absolus
  (aperçus de partage, sitemap, lien dans le message WhatsApp).

## Produit sans photo

Image par défaut (`src/components/catalogue/product-placeholder.tsx`) : pictogramme de la catégorie sur un
fond teinté de la couleur du site, libellé « Photo à venir ». Concerne uniquement les produits publiés
avant la règle « photo obligatoire » (voir `docs/products.md`).
