# Intelligence artificielle

**En pause par défaut** : `AI_ENABLED=true` dans le `.env` (puis redémarrer) pour l'activer ; sinon le bouton
n'apparaît pas et le reste du site fonctionne normalement (Paramètres › IA indique « IA en pause »).

L'IA n'est proposée **qu'à l'ajout d'un produit** (`/admin/produits/nouveau`), via un seul bouton
**« Générer avec l'IA »**. La fiche de modification n'a aucun assistant IA (seul le bouton
« Revenir à la photo d'origine » reste, pour annuler un fond blanc).

## Parcours (option B « hybride économique »)

1. L'admin choisit **une photo** du produit, puis règle avant de cliquer sur **Générer avec l'IA** :
   - **Photos supplémentaires** : Aucune / 1 / 2 (défaut : 2) ;
   - **type** : montages avec le produit d'origine (gratuits, défaut) ou mises en scène IA réalistes (payantes) ;
   - **Notes pour l'IA** (facultatif, 500 caractères) : matière, marque, taille, usage, argument clé… Elles sont
     ajoutées à la consigne du texte, entre délimiteurs, comme **faits fiables à utiliser en priorité** ; l'IA a
     pour consigne de les traiter comme des informations, jamais comme des ordres (pas de prix, etc.).
   - **Coût estimé** affiché en direct (`src/lib/ai-costs.ts`, testé) : ≈ 0,001 $ (texte) + ≈ 0,05 $ par mise en scène IA.
2. Le serveur enregistre la photo, la **détoure une seule fois**, puis prépare en parallèle :

| Résultat | Technique | Fidélité | Coût |
|---|---|---|---|
| Photo principale **fond blanc** | Détourage local (ISNet) + pose à l'échelle 1:1 sur `#FFFFFF`, ombre douce | **Pixels du produit identiques** (testé) | Gratuit |
| **2 montages** : « studio dégradé avec reflet », « table en bois clair » | Même produit détouré posé sur un décor **dessiné par le code** (dégradés, veinage procédural) : aucune image tierce, aucun droit d'auteur | **Pixels identiques** (testé pour chaque décor) | Gratuit |
| **Nom + description** | Petit modèle OpenAI « vision » (`gpt-6-luna` par défaut), Structured Outputs | Texte à relire | ≈ 0,001 $ |
| *Option* : **2 mises en scène IA** | OpenAI `images.edit`, qualité « medium », même face visible | **Redessinées** : texte/logo peuvent varier | ≈ 0,05 $ chacune |

   Durée : quelques secondes (≈ une minute avec l'option IA). Chaque partie peut échouer seule.
   Sans clé OpenAI : photos (fond blanc + montages) seulement.
3. **Aperçu complet avant enregistrement** :
   - photo principale : **Fond blanc** (par défaut) ou **Photo d'origine** ;
   - photos supplémentaires : montages **cochés par défaut** (badge « Produit d'origine ») ; mises en scène IA
     **décochées** (badge « Générée par l'IA » + avertissement). **2 au maximum** (3 photos par produit) ;
   - nom et description recopiés dans le formulaire, **modifiables**.
4. **Créer le produit** : seules les photos choisies sont rattachées, le reste est supprimé.
   Avec le fond blanc, l'**originale est conservée** : bouton « Revenir à la photo d'origine » sur la fiche.

### Limites du détourage (constatées sur des photos réelles)

- Partie du produit **de même couleur que le fond** (flacon jaune sur fond jaune) : elle peut disparaître.
- Petits éléments colorés près d'un fond chargé (bouchon) : peuvent être coupés.
- Photos prises **du dessus** (pinceau posé à plat) : les montages « posés » paraissent peu naturels.
- Conseil photo : produit **debout, de face**, sur un fond uni **contrasté** (mur clair pour un produit foncé, et inversement).
  En cas de défaut : choisir « Photo d'origine » et décocher les montages.

### Budget

- `AI_MONTHLY_BUDGET_USD` (10 $ par défaut) : le site **refuse lui-même** tout appel payant qui dépasserait le
  plafond du mois (message « Plafond mensuel des dépenses IA du site atteint »). Les photos locales continuent.
- Paramètres › IA : coût estimé du mois / plafond, avec jauge.
- Recommandé en plus : plafond sur le compte OpenAI (Billing › Limits).

Pourquoi pas « d'autres angles » : générer une vue de côté ou de dos obligerait l'IA à **inventer** des
faces jamais photographiées. Les montages et mises en scène gardent la face visible.

## Données

- `product_drafts` : la photo envoyée, en attente. `consumed_at` renseigné à la création du produit.
  Brouillon abandonné (page quittée, « Recommencer ») : fichiers supprimés ; automatiquement après 24 h.
- `ai_generations` : une ligne par partie (`IMAGE_STUDIO` : fond blanc et montages, `IMAGE_SCENE` : mises en scène IA, `TEXT`), liée au brouillon
  (`draft_id`) puis au produit. Statut PENDING → ACCEPTED / REJECTED, ou FAILED avec la cause.
  Jetons et coût estimé conservés.
- `product_images.source` : `AI_STUDIO` (fond blanc ou montage : produit d'origine), `AI_GENERATED` (mise en scène IA, badge « Générée par l'IA »).
- Le serveur ne fait jamais confiance aux clés de fichiers envoyées par le navigateur : il ne reçoit que
  l'identifiant du brouillon et les choix (fond blanc / origine, emplacements cochés, 2 au maximum).

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
| `AI_ENABLED` | `true` = bouton « Générer avec l'IA » visible (défaut : pause) |
| `OPENAI_API_KEY` | Clé secrète. Vide = parties OpenAI désactivées. Jamais préfixée `NEXT_PUBLIC_` |
| `OPENAI_MODEL` | Modèle texte + lecture de photo (défaut `gpt-6-luna`, le plus économique) |
| `OPENAI_IMAGE_MODEL` | Modèle des mises en scène IA optionnelles (défaut `gpt-image-2.5-sunburst`) |
| `AI_MONTHLY_BUDGET_USD` | Plafond mensuel des dépenses IA du site (défaut 10) |
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
| Plafond du site atteint | — | « Plafond mensuel des dépenses IA du site atteint… » |

## Code

| Fichier | Rôle |
|---|---|
| `src/server/ai/client.ts` | Clé, modèle, client OpenAI (serveur uniquement) |
| `src/server/ai/errors.ts` | Erreurs → messages en français (testé) |
| `src/server/ai/draft-service.ts` | Brouillon : génération parallèle, rattachement des choix, nettoyage |
| `src/server/ai/studio-cutout.ts` | Détourage, fond blanc, montages studio / table (testé : pixels identiques, photo vide refusée) |
| `src/server/ai/scenes-openai.ts` | Option : 2 mises en scène OpenAI, consigne stricte |
| `src/server/ai/budget.ts` | Plafond mensuel du site |
| `src/server/ai/product-text.ts`, `product-text-prompt.ts` | Nom + description (testé), test de connexion, résumé du mois |
| `src/server/ai/actions.ts` | Actions serveur (`requireAdmin()` en premier) |
| `src/app/admin/(protected)/produits/_components/new-product-ai.tsx` | Carte « Générer avec l'IA » |
| `src/app/admin/(protected)/produits/_components/draft-photos.tsx` | Aperçu et choix des photos |
| `src/app/admin/(protected)/parametres/_components/ai-*.tsx` | Encadré des Paramètres |
