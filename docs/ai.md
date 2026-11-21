# Intelligence artificielle

L'IA n'est proposée **qu'à l'ajout d'un produit** (`/admin/produits/nouveau`), via un seul bouton
**« Générer avec l'IA »**. La fiche de modification n'a aucun assistant IA (seul le bouton
« Revenir à la photo d'origine » reste, pour annuler un fond blanc).

## Parcours

1. L'admin choisit **une photo** du produit, puis clique sur **Générer avec l'IA**.
2. Le serveur enregistre la photo puis lance **en parallèle** :

| Résultat | Technique | Fidélité | Coût |
|---|---|---|---|
| Photo principale **fond blanc** | Détourage local (modèle ISNet) + pose à l'échelle 1:1 sur `#FFFFFF`, ombre douce | **Pixels du produit identiques** (test automatique : 0 pixel différent) | Gratuit |
| **2 mises en scène** | OpenAI `images.edit` : même face visible, autre décor (table bois / fond dégradé studio) | **Redessinées** : texte, logo ou forme peuvent varier malgré la consigne stricte | Payant |
| **Nom + description** | OpenAI (lecture de la photo, Structured Outputs) : français, sans prix ni caractéristique inventée | Texte à relire | Payant |

   Chaque partie peut échouer seule (crédit épuisé, pas de clé…) : les autres restent utilisables.
   Sans clé OpenAI, seule la photo fond blanc est générée.
3. **Aperçu complet avant enregistrement** :
   - photo principale : **Fond blanc** (par défaut) ou **Photo d'origine** ;
   - mises en scène : case **« Garder cette photo »**, **décochée par défaut** + avertissement ;
   - nom et description recopiés dans le formulaire, **modifiables**.
4. **Créer le produit** : le produit est créé, puis **seules les photos choisies** lui sont rattachées.
   Les fichiers non retenus sont supprimés. Avec le fond blanc, l'**originale est conservée**
   (`original_storage_key`) : bouton « Revenir à la photo d'origine » sur la fiche.

Pourquoi pas « d'autres angles » : générer une vue de côté ou de dos obligerait l'IA à **inventer** des
faces jamais photographiées (étiquette arrière, forme). Les mises en scène gardent la face visible.

## Données

- `product_drafts` : la photo envoyée, en attente. `consumed_at` renseigné à la création du produit.
  Brouillon abandonné (page quittée, « Recommencer ») : fichiers supprimés ; automatiquement après 24 h.
- `ai_generations` : une ligne par partie (`IMAGE_STUDIO`, `IMAGE_SCENE` ×2, `TEXT`), liée au brouillon
  (`draft_id`) puis au produit. Statut PENDING → ACCEPTED / REJECTED, ou FAILED avec la cause.
  Jetons et coût estimé conservés.
- `product_images.source` : `AI_STUDIO` (fond blanc), `AI_GENERATED` (mise en scène, badge « Générée par l'IA »).
- Le serveur ne fait jamais confiance aux clés de fichiers envoyées par le navigateur : il ne reçoit que
  l'identifiant du brouillon et les choix (fond blanc / origine, cases cochées).

## Compte OpenAI et facturation (à expliquer au client)

- Compte OpenAI **du magasin** sur https://platform.openai.com, **≠ abonnement ChatGPT** (qui ne
  donne pas accès à l'API).
- Paiement à l'utilisation (Billing) ; fixer un plafond mensuel (Billing › Limits).
- Clé API dans le `.env` du serveur, puis redémarrer le site.
- **Paramètres › Intelligence artificielle** : état de la clé, utilisations et coût estimé du mois,
  dernier problème de compte, bouton **Tester la connexion**.

## Configuration (`.env`)

| Variable | Rôle |
|---|---|
| `OPENAI_API_KEY` | Clé secrète. Vide = parties OpenAI désactivées. Jamais préfixée `NEXT_PUBLIC_` |
| `OPENAI_MODEL` | Modèle texte + lecture de photo (défaut `gpt-6.2-sol`) |
| `OPENAI_IMAGE_MODEL` | Modèle des mises en scène (défaut `gpt-image-2.5-sunburst`) |
| `MODELS_DIR` | Dossier du modèle de détourage (défaut `./storage/models`) |
| `OPENAI_BASE_URL` | Tests uniquement (faux serveur OpenAI) |

Modèle de détourage : `npm run ai:model` une fois par machine **et sur le serveur de production**
(≈ 170 Mo, ISNet, licence Apache-2.0, MD5 vérifié), exécuté par `onnxruntime-node` (MIT).
`@imgly/background-removal-node` écarté : licence AGPL.

## Sécurité

- Clé lue uniquement par `src/server/ai/client.ts` (`import "server-only"`). Vérifié par test : absente
  du HTML et du JavaScript envoyés au navigateur.
- Chaque action (`src/server/ai/actions.ts`) commence par `requireAdmin()`.
- `store: false` pour les appels texte : OpenAI ne conserve pas les échanges.

## Erreurs

| Cas | Code OpenAI | Message à l'admin |
|---|---|---|
| Clé absente | — | « L'IA n'est pas configurée… » |
| Clé fausse / révoquée | 401 | « Clé API OpenAI refusée… créez une nouvelle clé » |
| Crédit épuisé | 429 `insufficient_quota`, `credit_balance_exhausted` | « Crédit OpenAI épuisé : rechargez le compte… » |
| Plafond atteint | 429 `*_spend_limit_exceeded`, `*_usage_limit_exceeded` | « Plafond de dépenses atteint… » |
| Trop de demandes | 429 autres | « Patientez une minute » |
| Modèle inconnu | 404 / `model_not_found` | « Vérifiez OPENAI_MODEL » |
| OpenAI en panne | 5xx | « Momentanément indisponible » |
| Pas d'internet | connexion | « Impossible de joindre OpenAI » |
| Détourage non installé | — | « Lancez npm run ai:model » |
| Aucun produit net sur la photo | — | « Aucun produit net n'a été détecté… » |

## Code

| Fichier | Rôle |
|---|---|
| `src/server/ai/client.ts` | Clé, modèle, client OpenAI (serveur uniquement) |
| `src/server/ai/errors.ts` | Erreurs → messages en français (testé) |
| `src/server/ai/draft-service.ts` | Brouillon : génération parallèle, rattachement des choix, nettoyage |
| `src/server/ai/studio-cutout.ts` | Détourage + fond blanc (testé : pixels identiques, photo vide refusée) |
| `src/server/ai/scenes-openai.ts` | 2 mises en scène OpenAI, consigne stricte |
| `src/server/ai/product-text.ts`, `product-text-prompt.ts` | Nom + description (testé), test de connexion, résumé du mois |
| `src/server/ai/actions.ts` | Actions serveur (`requireAdmin()` en premier) |
| `src/app/admin/(protected)/produits/_components/new-product-ai.tsx` | Carte « Générer avec l'IA » |
| `src/app/admin/(protected)/produits/_components/draft-photos.tsx` | Aperçu et choix des photos |
| `src/app/admin/(protected)/parametres/_components/ai-*.tsx` | Encadré des Paramètres |
