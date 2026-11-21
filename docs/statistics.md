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

Organisation de la page (de haut en bas) :

1. **Filtres** repliables : période (7 j / 30 j / 90 j / 12 mois) et **catégorie** (`?periode=…&categorie=…`).
   Avec une catégorie, toutes les valeurs ne comptent que les événements liés à cette catégorie.
2. **4 indicateurs clés** (2 × 2, empilés sur mobile) : visites / visiteurs, consultations, clics WhatsApp,
   taux de contact ; aide « ? » (définition) et tendance vs période précédente.
3. **Évolution** : une courbe, onglets Visites / Consultations / Clics, infobulle, tableau des données.
4. **Répartitions** : anneaux Appareils et Provenance, légende en tuiles (nombre + %) ; au-delà de 4 parts,
   regroupement « Autres ». Palette catégorielle validée (`validate_palette.js`), libellés toujours visibles.
5. **Classements** : onglets Produits / Catégories (barres, clics, taux).

Aucune valeur inventée : sans historique, chaque bloc affiche un message explicatif.
Vérifié : valeurs (avec et sans filtre catégorie) identiques à un contrôle SQL indépendant.

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
| `src/app/admin/(protected)/statistiques/` | Page, filtres, indicateurs, courbe, anneaux (`donut-card.tsx`, testé), classements |

Vérifié : chiffres identiques à un contrôle SQL indépendant sur 90 jours de données simulées.
