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
Le seed ne modifie jamais un compte existant.
