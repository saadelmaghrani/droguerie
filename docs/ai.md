# Intelligence artificielle (OpenAI)

L'IA propose le **nom** et la **description** d'un produit à partir de sa photo principale et des
informations déjà saisies. L'admin relit, modifie, puis enregistre lui-même : **rien n'est écrit ni
publié automatiquement**.

## Compte et facturation (à expliquer au client)

- Le site utilise le compte OpenAI **du magasin**, créé sur https://platform.openai.com.
- **≠ abonnement ChatGPT** (Plus, Pro…) : celui-ci ne donne pas accès à l'API et ne sert à rien pour le site.
- Paiement **à l'utilisation** : ajouter du crédit dans Billing ; fixer un plafond dans Billing › Limits.
- Créer une clé dans API keys, puis la mettre dans le `.env` du serveur et redémarrer le site.

## Configuration (`.env`)

| Variable | Rôle |
|---|---|
| `OPENAI_API_KEY` | Clé secrète. Vide = IA désactivée (bouton remplacé par une explication). Jamais préfixée `NEXT_PUBLIC_` |
| `OPENAI_MODEL` | Modèle (défaut `gpt-6.2-sol`, lit les photos). Liste : https://developers.openai.com/api/docs/models |
| `OPENAI_IMAGE_MODEL` | Modèle de retouche d'image (défaut `gpt-image-2.5-sunburst`) |
| `MODELS_DIR` | Dossier du modèle de détourage (défaut `./storage/models`) |
| `OPENAI_BASE_URL` | Facultatif, tests uniquement (faux serveur OpenAI) |

## Sécurité

- La clé est lue uniquement par `src/server/ai/client.ts` (`import "server-only"` : la compilation
  échoue si un composant navigateur l'importe). Vérifié par un test : la clé n'apparaît ni dans le HTML ni
  dans les fichiers JavaScript envoyés au navigateur.
- Chaque action (`src/server/ai/actions.ts`) commence par `requireAdmin()`.
- `store: false` : OpenAI ne conserve pas les échanges.

## Fonctionnement

1. Fiche produit › **Assistant IA** › « Proposer un nom et une description ».
2. Le serveur envoie la photo principale (800 px, WebP) + nom, catégorie, marque, référence, description
   **actuels du formulaire** (même non enregistrés), avec un format de réponse imposé (Structured Outputs).
3. La proposition s'affiche dans des champs modifiables : **Utiliser ce texte** (recopie dans le formulaire),
   **Autre proposition** ou **Refuser**.
4. Chaque appel est enregistré dans `ai_generations` : PENDING → ACCEPTED / REJECTED, ou FAILED avec la cause.
   Jetons et coût estimé y sont conservés.

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
| Réponse inutilisable | refus, coupée, JSON invalide | « Réessayez… » |

Les problèmes **de compte** (clé, crédit, plafond, modèle) s'affichent en orange avec un lien vers
**Paramètres › Intelligence artificielle**, qui montre aussi : état de la clé, utilisations et coût estimé
du mois, dernier problème de compte, et un bouton **Tester la connexion** (requête de quelques jetons).

## Code

| Fichier | Rôle |
|---|---|
| `src/server/ai/client.ts` | Lecture de la clé et du modèle, client OpenAI (serveur uniquement) |
| `src/server/ai/errors.ts` | Erreurs OpenAI → messages en français (testé) |
| `src/server/ai/product-text-prompt.ts` | Consigne, format de réponse, lecture, coût estimé (testé) |
| `src/server/ai/product-text.ts` | Appel OpenAI, historique, test de connexion, résumé du mois |
| `src/server/ai/actions.ts` | Actions serveur (`requireAdmin()` en premier) |
| `src/app/admin/(protected)/produits/_components/ai-assistant.tsx` | Assistant dans la fiche produit |
| `src/app/admin/(protected)/parametres/_components/ai-*.tsx` | Encadré des Paramètres |

## Photo fond studio (photo principale)

Fiche produit › photo principale › **Fond studio**. Deux méthodes au choix :

| | Détourage fidèle (recommandé) | Version OpenAI |
|---|---|---|
| Principe | Modèle ISNet sur **notre serveur** : le fond est retiré, le produit posé sur un fond uniforme `#F4F4F5` avec une ombre douce | OpenAI (`images.edit`) régénère la photo sur fond studio, avec une consigne stricte |
| Produit | **Pixels identiques** à l'original : copiés à l'échelle 1:1, jamais redessinés (vérifié par un test automatique, 0 pixel différent) | **Redessiné** : marque, logo ou texte peuvent être altérés malgré la consigne |
| Coût | Gratuit (≈ 1 à 4 s de calcul) | Payé par le compte OpenAI du client (coût estimé enregistré) |
| Limites | Bords imparfaits possibles (objets transparents, fins) | Avertissement affiché : comparer avant d'utiliser |

Validation **obligatoire** :
1. La variante est créée **à côté** de la photo (fichiers + `ai_generations` PENDING) : la fiche ne change pas.
2. Fenêtre **avant / après** : « **Utiliser** » ou « **Garder l'originale** ». Fermer la fenêtre = garder l'originale.
3. « Utiliser » : la photo affiche la variante (`source = AI_STUDIO`), l'**originale est conservée**
   (`original_storage_key`). Bouton **Originale** sur la photo pour y revenir à tout moment.
4. Une nouvelle variante repart toujours de la photo **d'origine** (jamais d'une variante).
5. Variantes jamais validées (onglet fermé) : fichiers supprimés après 24 h.

Installation du modèle (une fois par machine, et sur le serveur de production) : `npm run ai:model`
→ `storage/models/isnet-general-use.onnx` (≈ 170 Mo, licence Apache-2.0, MD5 vérifié). Exécuté par
`onnxruntime-node` (MIT). Sans le modèle, la méthode affiche « Le détourage n'est pas installé… ».
Paquet `@imgly/background-removal-node` écarté : licence AGPL, incompatible avec un site commercial fermé.

| Fichier | Rôle |
|---|---|
| `src/server/ai/studio-cutout.ts` | Détourage ISNet + pose sur fond studio (testé : pixels identiques, photo vide refusée) |
| `src/server/ai/studio-openai.ts` | Variante OpenAI : consigne stricte, modèle `OPENAI_IMAGE_MODEL` |
| `src/server/ai/studio-service.ts` | Variante en attente, Utiliser / Garder l'originale / Revenir à l'originale |
| `src/server/ai/studio-actions.ts` | Actions serveur (`requireAdmin()` en premier) |
| `src/app/admin/(protected)/produits/_components/studio-dialog.tsx` | Fenêtre choix → avant/après → décision |
