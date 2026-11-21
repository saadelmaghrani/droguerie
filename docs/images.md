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
- Une nouvelle fiche doit d'abord être créée avant d'ajouter des photos (il faut l'identifiant du produit).

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
