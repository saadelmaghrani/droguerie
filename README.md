# Droguerie — Catalogue en ligne

Site vitrine d'une droguerie de gros au Maroc : catalogue de produits **sans prix**, contact par
**WhatsApp** (numéro selon la catégorie du produit), espace administrateur, assistance IA pour les
fiches produits et statistiques de visite.

Cahier des charges : [`docs/cahier_des_charges.pdf`](docs/cahier_des_charges.pdf)

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS 4 · shadcn/ui · PostgreSQL 18 · Prisma 7 · Docker Compose ·
VPS Hetzner (Caddy) en production.

## Prérequis

- Node.js 24 LTS
- Docker Desktop (lancé)

## Installation

```bash
npm install                 # dépendances + génération du client Prisma
cp .env.example .env        # puis remplir les valeurs (mots de passe, compte admin)
npm run db:up               # démarre PostgreSQL (Docker)
npx prisma migrate deploy   # crée les tables
npm run db:seed             # paramètres, compte admin, données de démo si SEED_DEMO_DATA=true
npm run dev                 # http://localhost:3000
```

Espace administrateur : http://localhost:3000/admin (identifiants : `ADMIN_EMAIL` / `ADMIN_PASSWORD` du `.env`).

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run lint` | Analyse du code (ESLint) |
| `npm test` | Tests unitaires (Vitest) |
| `npm run clean` | Supprime le cache de compilation `.next` (voir Dépannage) |
| `npm run db:up` / `db:down` | Démarrer / arrêter PostgreSQL |
| `npm run db:migrate -- --name <nom>` | Nouvelle migration après modification du schéma |
| `npm run db:seed` | Données initiales (relançable sans doublons) |
| `npm run db:studio` | Explorer la base dans le navigateur |

## Dépannage

**La page se recharge en boucle en développement** (`npm run dev`) : le cache de compilation
Turbopack (`.next/`) est dans un état incohérent. Arrêter le serveur avec `Ctrl + C`, puis :

```bash
npm run clean
npm run dev
```

Ce dossier ne contient que des fichiers générés : le supprimer ne fait rien perdre.
Arrêter toujours le serveur avec `Ctrl + C` plutôt que de fermer brutalement le Terminal.

## Documentation

| Document | Contenu |
|---|---|
| [`docs/database.md`](docs/database.md) | Tables, règles métier, recherche, migrations |
| [`docs/authentication.md`](docs/authentication.md) | Sessions admin, sécurité, règles à respecter |
| [`docs/admin-ui.md`](docs/admin-ui.md) | Interface admin : structure, ajouter une page, thème |
| [`docs/whatsapp.md`](docs/whatsapp.md) | Numéros WhatsApp : formats acceptés, règles métier |
| [`docs/categories.md`](docs/categories.md) | Catégories : champs, règles métier |
| [`docs/settings.md`](docs/settings.md) | Paramètres du magasin : champs, sécurité des liens |

## Variables d'environnement

Voir [`.env.example`](.env.example) (chaque variable y est commentée). Le fichier `.env` ne doit
jamais être commité.
