// Statistiques de visite : /admin/statistiques?periode=7j|30j|90j|12m&categorie=<id>
// Structure : filtres → 4 indicateurs clés → évolution (onglets) → répartitions (anneaux) → classements (onglets).
// Toutes les valeurs viennent de la base (src/server/analytics/stats.ts) ; blocs vides expliqués.
import type { Metadata } from "next";
import { Suspense } from "react";
import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBucket } from "@/lib/format-period";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/dal";
import { getStatsReport, periodFromUrl, PERIODS, type PeriodKey, type StatsReport } from "@/server/analytics/stats";
import { PageHeader } from "../_components/page-header";
import { DonutCardBody } from "./_components/donut-card";
import { KpiCard } from "./_components/kpi-card";
import { RankedBars } from "./_components/ranked-bars";
import { StatsFilters } from "./_components/stats-filters";
import { Tabs } from "./_components/stats-tabs";
import { TrendChart } from "./_components/trend-chart";

export const metadata: Metadata = { title: "Statistiques" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const n = (v: number) => v.toLocaleString("fr-FR");
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function EvolutionTable({ report }: { report: StatsReport }) {
  return (
    <details>
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">Voir les données en tableau</summary>
      <div className="mt-3 max-h-80 overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{report.bucket === "month" ? "Mois" : "Jour"}</th>
              <th className="px-3 py-2 text-right font-medium">Visiteurs</th>
              <th className="px-3 py-2 text-right font-medium">Visites</th>
              <th className="px-3 py-2 text-right font-medium">Consultations</th>
              <th className="px-3 py-2 text-right font-medium">Clics WhatsApp</th>
            </tr>
          </thead>
          <tbody className="divide-y tabular-nums">
            {[...report.series].reverse().map((s) => (
              <tr key={s.bucket}>
                <td className="px-3 py-1.5">{formatBucket(s.bucket, report.bucket, true)}</td>
                <td className="px-3 py-1.5 text-right">{n(s.visitors)}</td>
                <td className="px-3 py-1.5 text-right">{n(s.visits)}</td>
                <td className="px-3 py-1.5 text-right">{n(s.productViews)}</td>
                <td className="px-3 py-1.5 text-right">{n(s.whatsappClicks)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

async function StatsContent({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin(); // vérification de la session, AVANT la lecture des données
  const sp = await searchParams;
  const period = periodFromUrl(first(sp.periode));
  const categories = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  const requested = first(sp.categorie);
  const categoryId = UUID.test(requested) && categories.some((c) => c.id === requested) ? requested : null;
  const report = await getStatsReport(period, categoryId);
  const { totals, changes, series, bucket } = report;
  const empty = totals.pageViews === 0 && totals.productViews === 0 && totals.whatsappClicks === 0;
  const unitLabel = bucket === "month" ? "par mois" : "par jour";
  const point = (key: "visits" | "productViews" | "whatsappClicks") => series.map((s) => ({ bucket: s.bucket, value: s[key] }));

  return (
    <div className="grid gap-6">
      <StatsFilters
        periods={(Object.keys(PERIODS) as PeriodKey[]).map((key) => ({ key, label: PERIODS[key].label }))}
        period={period}
        categories={categories}
        categoryId={categoryId ?? ""}
        rangeLabel={`Du ${formatBucket(report.start, "day", true)} au ${formatBucket(report.end, "day", true)}`}
      />

      {empty && (
        <p className="flex items-start gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Aucune visite enregistrée sur cette période{categoryId ? " pour cette catégorie" : ""}. Les visites du site public sont
          comptées automatiquement (celles des appareils du magasin ne le sont pas).
        </p>
      )}

      {/* 1. Indicateurs clés */}
      <section aria-label="Indicateurs clés" className="grid gap-4 md:grid-cols-2">
        <KpiCard
          title="Visites / Visiteurs"
          help="Visite : nouvelle session après 30 minutes d'inactivité. Visiteur : personne distincte chaque jour (identifiant anonyme, sans cookie)."
          parts={[
            { value: n(totals.visits), unit: totals.visits > 1 ? "visites" : "visite" },
            { value: n(totals.visitors), unit: totals.visitors > 1 ? "visiteurs" : "visiteur" },
          ]}
          change={changes.visits}
        />
        <KpiCard
          title="Consultations de produits"
          help="Nombre de fiches produit affichées sur le site."
          parts={[{ value: n(totals.productViews), unit: totals.productViews > 1 ? "fiches vues" : "fiche vue" }]}
          change={changes.productViews}
        />
        <KpiCard
          title="Clics WhatsApp"
          help="Clics sur un bouton WhatsApp du site (fiche produit, barre mobile, accueil, pied de page) : demandes de prix ou de contact."
          parts={[{ value: n(totals.whatsappClicks), unit: totals.whatsappClicks > 1 ? "demandes" : "demande" }]}
          change={changes.whatsappClicks}
        />
        <KpiCard
          title="Taux de contact"
          help="Clics WhatsApp divisés par les consultations de produits : part des visiteurs d'une fiche qui demandent le prix."
          parts={[{ value: totals.contactRate == null ? "—" : totals.contactRate.toLocaleString("fr-FR"), unit: totals.contactRate == null ? undefined : "%" }]}
        />
      </section>

      {/* 2. Évolution */}
      <Card>
        <CardHeader>
          <CardTitle>Évolution {unitLabel}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Tabs
            label="Mesure affichée"
            tabs={[
              { key: "visits", label: "Visites", content: <TrendChart title="Visites" unitLabel="visites" unit={bucket} height={220} points={point("visits")} /> },
              { key: "views", label: "Consultations", content: <TrendChart title="Consultations de produits" unitLabel="consultations" unit={bucket} height={220} points={point("productViews")} /> },
              { key: "clicks", label: "Clics WhatsApp", content: <TrendChart title="Clics WhatsApp" unitLabel="clics" unit={bucket} height={220} points={point("whatsappClicks")} /> },
            ]}
          />
          <EvolutionTable report={report} />
        </CardContent>
      </Card>

      {/* 3. Répartitions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Appareils</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutCardBody slices={report.devices} unit="visites" emptyText="Pas encore de visites sur cette période." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Provenance des visites</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutCardBody slices={report.sources} unit="visites" emptyText="Pas encore de visites sur cette période." />
          </CardContent>
        </Card>
      </div>

      {/* 4. Classements */}
      <Card>
        <CardHeader>
          <CardTitle>Les plus consultés</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs
            label="Classement"
            tabs={[
              {
                key: "products",
                label: "Produits",
                content: <RankedBars rows={report.topProducts} viewsLabel="Consultations" empty="Aucune fiche produit consultée sur cette période." />,
              },
              ...(categoryId
                ? []
                : [
                    {
                      key: "categories",
                      label: "Catégories",
                      content: <RankedBars rows={report.topCategories} viewsLabel="Consultations (catégorie + fiches)" empty="Aucune catégorie consultée sur cette période." />,
                    },
                  ]),
            ]}
          />
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Mesure sans cookie : identifiant anonyme qui change chaque jour (aucune adresse IP conservée). Robots, aperçus de liens et
        appareils du magasin ne sont pas comptés. Données conservées 25 mois.
      </p>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden>
      <Skeleton className="h-12 rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export default function StatisticsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader title="Statistiques" description="Visites, consultations et clics WhatsApp." />
      <Suspense fallback={<StatsSkeleton />}>
        <StatsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
