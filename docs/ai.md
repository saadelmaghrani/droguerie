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
   - **Coût estimé** affiché en direct (`src/lib/ai-costs.ts`, testé) : ≈ 0,001 $ (texte) + ≈ 0,05 $ par photo générée par l'IA.
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
- **Paramètres › Assistant IA** (vu par le commerçant) : activé / désactivé / indisponible, utilisations et
  coût estimé du mois, dernière alerte en langage simple, bouton **Tester la connexion**. Le diagnostic
  technique est dans le journal du serveur (voir « Erreurs »).

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

## Catégorie automatique

Lors de l'analyse de la photo (« Générer avec l'IA »), l'IA reçoit la **liste complète** des catégories
(codes C1, C2…, masquées comprises) et applique la première règle qui s'applique :
1. une catégorie existante est **dédiée** à la famille du produit (synonymes compris) → `category_ref` ;
2. seule une catégorie **large** pourrait l'accueillir (« Quincaillerie », « Outillage »…) ET le produit appartient
   à une **famille distincte et utile** au catalogue (vis → « Visserie », cadenas → « Cadenas et serrures ») →
   `new_category` + la catégorie large en `fallback_ref` (proposée en alternative au magasin) ;
3. une catégorie convient et le produit n'a pas de famille distincte (article isolé) → `category_ref` ;
4. aucune ne convient → `new_category`.

Garde-fou serveur (`src/lib/category-match.ts`, testé) : un nouveau nom équivalent à une catégorie existante est
**rattaché à l'existante** — pas de doublon. Équivalent = mêmes mots aux accents / majuscules / pluriel / petits
mots / mots génériques près, variantes de famille (« Vis » = « Visserie », « Boulons » = « Boulonnerie »,
« Ampoules » = « Éclairage », « Adhésifs » = « Colles »), même adresse, ou énumération (« Colles » ⊂ « Colles et
adhésifs », « Chevilles » ⊂ « Chevilles & fixations »). Une catégorie plus précise n'est pas un doublon
(« Outillage à main » ≠ « Outillage », « Peinture » ≠ « Accessoires de peinture »).

Formulaire « Nouveau produit » :
- catégorie existante → sélectionnée, mention « Catégorie choisie par l'IA » ;
- nouvelle → option « Nom (nouvelle) » sélectionnée, mention « Nouvelle catégorie proposée par l'IA… créée
  automatiquement à l'enregistrement » et, pour une famille spécifique, bouton « Classer plutôt dans « Quincaillerie » » ;
- une catégorie déjà choisie par l'admin avant la génération n'est jamais remplacée ;
- modifiable avant (menu) et après l'enregistrement (fiche).

Création : à « Créer le produit », dans la **même transaction** que le produit (`findOrCreateCategory`,
`src/server/categories/service.ts`) : nouvelle vérification anti-doublon, adresse unique (`-2`, `-3`…),
placée en fin de liste, visible. Message « Catégorie « X » créée automatiquement ». Rien n'est créé si l'admin
choisit une autre catégorie ou abandonne. IA désactivée ou en échec : choix manuel inchangé ; la création
manuelle d'une catégorie se fait toujours dans Catégories.

## Clé API : provenance, contrôle et rechargement

**D'où vient la clé ?** Next.js cherche `OPENAI_API_KEY` dans cet ordre et garde la PREMIÈRE trouvée :
1. variable du système (exportée dans le terminal, Docker, hébergeur) ;
2. `.env.development.local` / `.env.production.local` ;
3. `.env.local` ;
4. `.env.development` / `.env.production` ;
5. `.env`.

Règle du projet : **la clé est uniquement dans `.env`** (aucun `.env.local`, aucun `export` dans `~/.zshrc`).

**Contrôles mis en place** (`src/server/ai/key-check.ts`, testé ; `key-status.ts`) :
- au démarrage du serveur (`src/instrumentation.ts`, si `AI_ENABLED=true`), une ligne `[IA] Clé OpenAI : …`
  dans le journal : format, fichier de provenance, conflit éventuel ;
- avant chaque appel : une clé mal formatée n'est PAS envoyée à OpenAI (erreur `malformed_key`) ;
- chaque échec : `logAiError()` écrit le type, la consigne technique et l'indice `sk-…abcd` de la clé utilisée ;
- Paramètres › Assistant IA (commerçant) : seulement « activé / désactivé / indisponible », la consommation,
  la dernière alerte en langage simple et « Tester la connexion » — aucun détail technique ;
- les échecs liés à la clé enregistrent son indice : si la clé a été changée depuis, l'ancienne alerte n'est
  plus affichée.

**Recharger après modification du `.env` :**
- en local (`npm run dev`) : rechargé automatiquement à l'enregistrement (Next.js surveille les fichiers `.env*`) ;
  le client OpenAI est recréé dès que la clé change (aucune ancienne clé en cache) ;
- en production (`npm start` / Docker) : le `.env` n'est lu qu'au démarrage → redémarrer le site.
  Le `.env` du serveur est distinct de celui de l'ordinateur de développement.

## Sécurité

- Clé lue uniquement par `src/server/ai/client.ts` (`import "server-only"`). Vérifié par test : absente
  du HTML et du JavaScript envoyés au navigateur.
- Chaque action (`src/server/ai/actions.ts`) commence par `requireAdmin()`.
- `store: false` pour les appels texte : OpenAI ne conserve pas les échanges.

## Erreurs

**Deux niveaux de messages** (`src/server/ai/errors.ts`) :
- `AI_MESSAGES` — affichés dans l'admin, en langage commerçant : jamais de nom de fichier, de variable, de
  code HTTP ni de commande ; toujours une issue (« remplissez la fiche manuellement »). Garanti par un test.
- `TECH_HINTS` — consigne technique pour le prestataire, écrite **uniquement dans le journal du serveur** par
  `logAiError()` (type d'erreur, consigne, détail OpenAI, indice de clé `sk-…abcd`).

| Cas | Code OpenAI | Affiché à l'admin | Journal serveur (extrait) |
|---|---|---|---|
| Clé absente / mal formatée / refusée / expirée, accès refusé, modèle inconnu, détourage non installé | — / 401 / 403 / 404 | « L'assistant IA n'est pas disponible pour le moment. Vous pouvez remplir la fiche manuellement. Si cela dure, contactez votre prestataire. » | `expired_key — HTTP 401 expired_secret_key : nouvelle clé…, remplacer OPENAI_API_KEY dans le .env…` |
| Crédit épuisé | 429 `insufficient_quota` | « Le crédit de l'assistant IA est épuisé… » | `billing — HTTP 429 insufficient_quota…` |
| Plafond OpenAI / plafond du site | 429 `*_limit_exceeded` / — | « La limite de dépenses… » / « Le plafond mensuel… » | `spend_limit` / `budget — AI_MONTHLY_BUDGET_USD…` |
| Trop de demandes | 429 autres | « L'assistant IA est très sollicité… » | `rate_limit` |
| OpenAI en panne / injoignable | 5xx / connexion | « Service IA temporairement indisponible / injoignable… » | `unavailable` / `network` |
| Réponse inutilisable | — | « L'IA n'a pas pu proposer de résultat cette fois-ci… » | `bad_response` + détail |
| Aucun produit net sur la photo | — | « Aucun produit net n'a été détecté… » | `no_subject` |

Où lire le diagnostic : terminal de `npm run dev` en local ; `docker compose logs app` (ou équivalent) en production.
Lignes à chercher : `[IA] Clé OpenAI : …` (au démarrage) et `[IA] Brouillon …` / `[IA] Test de connexion : …`.

**IA désactivée ou en panne : rien n'est bloqué.** Avec `AI_ENABLED` différent de `true`, la carte « Générer
avec l'IA » est masquée et l'encadré des Paramètres indique « Assistant IA désactivé ». En cas d'échec, la partie
concernée est marquée « non générée » et la fiche se remplit à la main ; photos, création, modification,
remplacement, suppression et photo principale fonctionnent normalement (vérifié de bout en bout dans les deux cas).

## Code

| Fichier | Rôle |
|---|---|
| `src/server/ai/client.ts` | Clé, modèle, client OpenAI (serveur uniquement) |
| `src/server/ai/key-check.ts`, `key-status.ts`, `src/instrumentation.ts` | Contrôle de la clé : format, provenance, conflits, journal de démarrage (testé) |
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

## Photos « Générées par l'IA » : fond blanc pur par défaut

- **Par défaut** (`sceneBackground = "white"`) : consignes `WHITE_PROMPTS` (`src/server/ai/scenes-openai.ts`) —
  packshot e-commerce sur blanc pur `#FFFFFF`, produit centré, entier et net ; interdits : atelier, table, sol,
  mur, accessoires, dégradé, fond coloré/gris, reflet. Les règles strictes de fidélité au produit restent.
- **Garantie** (`enforceWhiteBackground`) : l'image renvoyée par OpenAI est détourée localement puis recadrée
  comme la photo principale (`composeWhite` : #FFFFFF, centré, 12 % de marge). Repli si détourage impossible :
  pixels quasi blancs (≥ 240) forcés à #FFFFFF (`whitenNearWhite`).
- **Indication contraire** : choix « Fond des photos IA → Mise en scène (table, studio) » dans la carte
  « Générer avec l'IA » (`sceneBackground = "scene"`) : anciennes consignes `SCENE_PROMPTS`, image non retouchée.
- Libellés : « Fond blanc IA n » / « Mise en scène IA n ». Les montages locaux (gratuits) sont inchangés.

## Photo principale après génération

- **Par défaut** (`defaultDraftChoice`, `draft-photos.tsx`) : la 1re photo « Générée par l'IA » devient la photo
  principale ; sans photo IA : fond blanc (détourage) ; sinon la photo d'origine.
- Choix proposés : Générée par l'IA (recommandé) · variante IA · Fond blanc (détourage) · Photo d'origine.
  La photo choisie comme principale n'est pas reproposée en photo supplémentaire.
- **Photo d'origine = sauvegarde** (`attachDraftToProduct`) : si la principale est une photo IA ou le fond blanc,
  l'originale n'est PAS publiée ; elle est gardée dans `original_storage_key` → « Revenir à la photo d'origine ».
  Elle n'est publiée que si l'admin choisit explicitement « Photo d'origine ».
