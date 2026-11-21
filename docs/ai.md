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

## À venir

Photo professionnelle (détourage + fond studio, sans modifier les pixels du produit) : à décider.
