# Statistiques

Page : `/admin/statistiques?periode=7j|30j|90j|12m` (résumé des 7 derniers jours sur le tableau de bord).

## Ce qui est affiché

| Indicateur | Définition |
|---|---|
| Visiteurs | Personnes distinctes **par jour**, additionnées sur la période (l'identifiant change chaque jour) |
| Visites | Sessions : une nouvelle visite commence après 30 minutes sans activité |
| Consultations de produits | Fiches produit affichées |
| Clics WhatsApp | Clics sur un bouton WhatsApp (fiche, barre mobile, accueil, pied de page) |
| Taux de contact | Clics WhatsApp ÷ consultations |

Plus : variation par rapport à la période précédente de même durée, 3 courbes (visites, consultations,
clics ; par jour, ou par mois sur 12 mois) avec infobulle et tableau des données, produits et catégories
les plus consultés (avec clics et taux), appareils, provenance (Google, Facebook…).

## Collecte (respect de la vie privée, sans bandeau cookies)

- Le site public envoie un événement à `POST /api/events` à chaque page affichée et à chaque clic sur un
  lien WhatsApp (`src/components/site/analytics-tracker.tsx`, `navigator.sendBeacon`).
- **Aucun cookie ni stockage chez le visiteur.** Identifiant = hachage (IP + navigateur + sel du jour) :
  l'IP n'est jamais enregistrée et le sel change chaque jour.
- Provenance réduite au nom du site (`google.com`), adresses sans paramètres.
- « Do Not Track » / « Global Privacy Control » respectés.
- Non comptés : robots et aperçus de liens (WhatsApp, Facebook…), préchargements, pages introuvables
  et brouillons, **appareils du magasin** (cookie `stats_ignore` posé à la connexion admin, valable 1 an).
- Limite : 60 événements par minute et par visiteur.
- Conservation : 25 mois, puis suppression automatique.

`ANALYTICS_SECRET` (`.env`, facultatif) : secret du hachage ; par défaut dérivé de `DATABASE_URL`.

## Code

| Fichier | Rôle |
|---|---|
| `src/lib/analytics.ts` | Robots, appareil, provenance, nature de la page, jour au Maroc (testé) |
| `src/server/analytics/ingest.ts` | Hachage du visiteur, visite en cours, enregistrement |
| `src/app/api/events/route.ts` | Point d'entrée (204 dans tous les cas) |
| `src/server/analytics/stats.ts` | Calculs SQL (fuseau `Africa/Casablanca`), périodes, comparaison |
| `src/app/admin/(protected)/statistiques/` | Page, indicateurs, courbes, classements |

Vérifié : chiffres identiques à un contrôle SQL indépendant sur 90 jours de données simulées.
