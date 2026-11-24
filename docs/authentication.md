# Authentification de l'espace administrateur

Sessions stockées en base de données, codées dans le projet (sans bibliothèque d'authentification).
Référence : guide Next.js 16 « Authentication → Database Sessions » et *The Copenhagen Book*.

**Pourquoi pas Auth.js ?** La v5 (seule adaptée à l'App Router) est toujours en bêta, et son mode
email + mot de passe impose des sessions JWT non révocables. Décision validée le 21/11/2026.

## Fonctionnement

```
Navigateur ──► src/proxy.ts            vérification RAPIDE : le cookie existe-t-il ?
                 │ non → /admin/login?next=…
                 ▼ oui (et prolonge le cookie)
               Page admin ──► requireAdmin()   vérification COMPLÈTE en base
               Action admin ──► requireAdmin() chaque action est vérifiée
```

| Fichier | Rôle |
|---|---|
| `src/server/auth/cookie.ts` | Nom et attributs du cookie (sans dépendance, importé par le proxy) |
| `src/server/auth/session.ts` | Création, validation, prolongation, suppression des sessions |
| `src/server/auth/dal.ts` | `getCurrentAdmin()` et `requireAdmin()` : **point d'entrée unique** |
| `src/server/auth/actions.ts` | Actions serveur `login` et `logout` |
| `src/server/auth/rate-limit.ts` | Limitation des tentatives de connexion |
| `src/server/auth/request-info.ts` | IP et navigateur du visiteur |
| `src/proxy.ts` | Redirection rapide des visiteurs sans cookie |
| `src/app/admin/login/` | Page et formulaire de connexion |
| `src/app/admin/(protected)/` | Pages protégées (tableau de bord…) |

## ⚠️ Règle à respecter pour chaque nouvelle page ou action admin

```ts
import { requireAdmin } from "@/server/auth/dal";

const admin = await requireAdmin(); // en PREMIER, avant toute lecture/écriture
```

Le proxy et le layout ne sont **pas** des protections suffisantes (le proxy ne vérifie que la
présence du cookie ; un layout ne se réexécute pas à chaque navigation).

Avec Cache Components, un composant qui appelle `requireAdmin()` doit être placé dans un
`<Suspense>` (voir `src/app/admin/(protected)/page.tsx`).

## Sécurité

| Mesure | Détail |
|---|---|
| Jeton de session | 256 bits aléatoires (`crypto.randomBytes`), dans un cookie |
| Stockage | La base contient l'empreinte **SHA-256** du jeton, jamais le jeton |
| Cookie | `HttpOnly`, `SameSite=Lax`, `Path=/admin`, `Secure` en production |
| Durée | 7 jours d'inactivité ; prolongée automatiquement à l'usage |
| Révocation | Déconnexion = suppression en base ; compte désactivé = accès coupé immédiatement |
| Mots de passe | argon2id (`@node-rs/argon2`) |
| Force brute | 5 échecs / 15 min par email, 20 échecs / 15 min par IP |
| Énumération des comptes | Même message et même temps de réponse pour email inconnu ou mauvais mot de passe |
| Redirection après connexion | Uniquement vers `/admin…` (pas de redirection vers un autre site) |
| CSRF | Vérification d'origine des actions serveur par Next.js + `SameSite=Lax` |
| Moteurs de recherche | `noindex, nofollow` sur tout `/admin` |

**Limite connue** : 5 échecs volontaires sur l'email de l'admin le bloquent 15 minutes
(compromis classique face à la force brute).

**Production** : l'IP est lue dans `X-Forwarded-For`, posé par Caddy. L'application ne doit
jamais être exposée directement sans Caddy devant (sinon l'IP pourrait être falsifiée).

## Points d'attention Next.js 16.4.6

- Ne pas lire `cookies()` pendant le rendu de `/admin/login` : en développement, Next.js lève
  une `InvariantError` lors du réaffichage qui suit une connexion échouée (bug de Next.js,
  absent en production).
- Ne pas utiliser `useSearchParams()` dans le formulaire de connexion : en production, cela
  force un rendu uniquement côté navigateur. `next` est lu côté serveur et passé en prop.

## Gestion des comptes

Le premier compte est créé par `npm run db:seed` à partir de `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
Le seed ne modifie jamais un compte existant : **changer `ADMIN_PASSWORD` dans `.env` après coup n'a aucun effet**.
Ensuite, tout se fait depuis la page **Mon compte** (`/admin/compte`, menu de l'administration).

| Action | Règles |
|---|---|
| Nom affiché | 2 à 60 caractères |
| Mot de passe | Mot de passe actuel obligatoire ; nouveau : 12 à 256 caractères, saisi deux fois, différent de l'actuel, pas d'espace au début/à la fin, au moins 4 caractères différents |
| Email de connexion | Mot de passe actuel obligatoire ; format vérifié, mis en minuscules, refusé s'il est déjà pris |
| Après mot de passe ou email modifié | Les **autres** appareils sont déconnectés ; celui en cours reste connecté (la session est liée à l'identifiant du compte, pas à l'email) |
| Mauvais mot de passe actuel | Compte comme un échec de connexion : même blocage (5 échecs / 15 min) — une session volée ne permet pas de deviner le mot de passe |

Pas de confirmation par email du nouvel email : le projet n'envoie pas d'emails (pas de SMTP). D'où la vérification
du mot de passe actuel et le message « utilisez … à la prochaine connexion ».

| Fichier | Rôle |
|---|---|
| `src/lib/account-validation.ts` | Règles de saisie (testées) |
| `src/server/auth/account.ts` | Vérification du mot de passe actuel, mises à jour, déconnexion des autres appareils |
| `src/server/auth/account-actions.ts` | Actions serveur de la page (`requireAdmin()` en premier) |
| `src/app/admin/(protected)/compte/` | Page et formulaires |

### Mot de passe oublié : commande de secours

Il n'y a volontairement **pas** de lien « mot de passe oublié » sur le site. Sur le serveur (accès au terminal = preuve
d'être le propriétaire) :

```bash
npm run admin:reset-password
```

La commande liste les comptes, demande l'email puis le nouveau mot de passe (saisie masquée, deux fois, mêmes
règles que la page). Effets : nouveau mot de passe, compte réactivé, **tous** les appareils déconnectés, blocage
« trop de tentatives » levé. En production, à lancer dans le conteneur de l'application une fois le déploiement en place.
