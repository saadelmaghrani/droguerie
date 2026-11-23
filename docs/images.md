# Images (photos produits, logo, bannière)

## Parcours d'une image

```
Navigateur ── vérifie taille (8 Mo) et type ──► action serveur (requireAdmin() d'abord)
                                                  │
                    src/server/media/images.ts ◄──┘
                    1. lit l'EN-TÊTE : vrai format (pas l'extension), dimensions
                    2. refuse : SVG, non-image, < 200 px, > 50 millions de pixels
                    3. redresse selon l'orientation EXIF (photos de téléphone)
                    4. génère les tailles en WebP, SANS aucune métadonnée (ni EXIF, ni GPS)
                                                  │
                    src/server/media/storage.ts ◄─┘  dossier UPLOAD_DIR (défaut ./storage/uploads)
                                                  │
Navigateur ◄── GET /media/<clé>-<taille>.webp ────┘  cache 1 an (immutable), nosniff
```

| Usage | Tailles générées | Fichiers |
|---|---|---|
| Photo produit | 320 (vignette), 800 (catalogue), 1600 (fiche) + original ≤ 2400 (pour l'IA) | `products/<id-produit>/<clé>-<taille>.webp` |
| Logo | 128, 256, 512 (transparence conservée) | `settings/logo/<clé>-<taille>.webp` |
| Bannière | 800, 1600, 2400 | `settings/hero/<clé>-<taille>.webp` |

La clé est aléatoire (128 bits) et **jamais réutilisée** : un fichier ne change jamais, d'où le cache d'un an.
Remplacer une image crée une nouvelle clé et supprime les anciens fichiers.

## Photos produit

- 3 emplacements : **0 = principale** (catalogue, vignette), 1 et 2 = secondaires.
- Ajout au premier emplacement libre ; maximum vérifié avant traitement + contrainte en base.
- Réorganisation par **échange du contenu** de deux emplacements (la base interdit les positions hors 0–2).
- Suppression : les emplacements suivants sont décalés (la principale existe toujours si une photo reste).
- Supprimer un produit supprime ses fichiers images du disque.
- Nouvelle fiche : les photos peuvent être choisies avant la création. Elles restent dans le navigateur
  (`pending-images.tsx`), puis sont envoyées une par une juste après « Créer le produit », dans l'ordre
  choisi (la 1re devient la principale). Une photo refusée n'empêche pas la création : un message
  l'indique et elle peut être ajoutée ensuite depuis la fiche.

## Sécurité

| Risque | Protection |
|---|---|
| Fichier déguisé (HTML renommé en .jpg) | Format détecté sur le contenu, pas sur l'extension |
| SVG avec script | Refusé |
| « Bombe » de décompression | Plus de 50 millions de pixels refusés avant décodage |
| Fuite de la position GPS du téléphone | Aucune métadonnée écrite en sortie |
| Lecture de fichiers hors du dossier (`../../.env`) | Route `/media` : liste blanche stricte des noms + vérification du chemin dans `storage.ts` |
| Envoi par une personne non connectée | Toutes les actions commencent par `requireAdmin()` |
| Fichiers énormes | 8 Mo par fichier (navigateur + serveur), `bodySizeLimit: 9mb` dans `next.config.ts` |

## Limites connues

- **HEIC (iPhone)** non pris en charge par la version de sharp utilisée : message clair invitant à
  envoyer en JPEG. En pratique, Safari sur iPhone convertit généralement en JPEG lors de l'envoi.
- Pas de barre de progression pendant l'envoi (indicateur « Envoi et traitement… »).

## Production

- `UPLOAD_DIR` doit pointer vers un **volume Docker** persistant et **sauvegardé** (avec la base).
- Optimisation possible : Caddy sert directement `UPLOAD_DIR` sous `/media` (la route Next.js reste
  la référence fonctionnelle).

## Photo « studio » automatique (photos produit)

Toute photo produit ajoutée ou remplacée — admin (création, fiche), script `import:demo` — passe par
`processProductPhoto` (`src/server/products/studio-photo.ts`) :

1. **Détourage local** : modèle ISNet (`npm run ai:model`, ≈ 170 Mo, gratuit, sur le serveur, ~3 s/photo).
   Le fond d'origine (établi, table, chantier, sol, logos/filigranes) est supprimé.
2. **Redressement prudent** (`straightenAngle`) : seulement un objet nettement allongé (rapport ≥ 3) penché
   de 2 à 12°. Une forme complexe ou un outil posé en diagonale exprès n'est pas tourné.
3. **Cadrage** (`composeWhite`) : carré, fond blanc pur `#FFFFFF`, produit centré occupant 76 % du côté
   (**12 % de marge**), ombre de contact douce ; canevas d'au moins 600 px (petit produit agrandi).
4. **Enregistrement** : WebP 320 / 800 / 1600 (`source = AI_STUDIO`), photo d'origine conservée
   (`original_storage_key`) → bouton « Revenir à la photo d'origine » dans l'admin.

**Repli** (photo gardée telle quelle, message à l'admin) : modèle absent, aucun produit net, ou contour
trop incertain (> 35 % : affiche publicitaire, visuel graphique, objet transparent) — `uncertainRatio`.

Limite : pas de correction de **perspective** (photo prise en plongée) : un modèle 2D ne peut pas
« redresser » un objet en 3D sans le redessiner, ce qui trahirait le produit.

### Un seul article mis en avant

- **Lot / pack ?** `isMultiPack(nom, notes)` (`src/lib/multi-pack.ts`) : lot, pack, kit, jeu, set, coffret,
  assortiment, paire, boîte de…, x10, 19pcs, 10 pièces (pas les dimensions « 5 m x 19 mm »).
- **Copies séparées** (local, fidèle au pixel) : `isolateMainCopy` — ≥ 3 silhouettes de même taille et forme →
  seul l'exemplaire principal (le plus grand, puis le plus central) est gardé. 2 silhouettes = souvent une paire :
  gardées. Ignoré pour un lot / pack.
- **Fragments fantômes** : `dropGhostFragments` retire les morceaux détachés, pâles et petits (bout d'enseigne,
  reflet) ; un accessoire net et opaque est conservé.
- **Copies qui se chevauchent** (présentoir, pinces suspendues) : une seule silhouette, impossible à séparer sans
  redessiner. Le détourage local fait souvent ressortir l'article de devant ; pour les photos générées par l'IA,
  la consigne `SINGLE_ITEM_RULE` (`scenes-openai.ts`) impose UN exemplaire (sinon `PACK_RULE`).
