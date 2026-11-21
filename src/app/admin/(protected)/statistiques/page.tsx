// Statistiques de visite : /admin/statistiques?periode=7j|30j|90j|12m
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/dal";
import { getStatsReport, periodFromUrl, PERIODS, type PeriodKey } from "@/server/analytics/stats";
import { PageHeader } from "../_components/page-header";
import { KpiTile } from "./_components/kpi-tile";
import { RankedBars, ShareBars } from "./_components/ranked-bars";
import { formatBucket } from "@/lib/format-period";
import { TrendChart } from "./_components/trend-chart";

export const metadata: Metadata = { title: "Statistiques" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const n = (v: number) => v.toLocaleString("fr-FR");

function PeriodTabs({ active }: { active: PeriodKey }) {
  return (
    <nav aria-label="Période" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 w-fit">
      {(Object.keys(PERIODS) as PeriodKey[]).map((key) => (
        <Link
          key={key}
          href={`/admin/statistiques?periode=${key}`}
          aria-current={key === active ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            key === active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {PERIODS[key].label}
        </Link>
      ))}
    </nav>
  );
}

async function StatsContent({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin(); // vérification de la session, AVANT la lecture des données
  const sp = await searchParams;
  const period = periodFromUrl(Array.isArray(sp.periode) ? sp.periode[0] : sp.periode);
  const report = await getStatsReport(period);
  const { totals, changes, series, bucket } = report;
  const empty = totals.pageViews === 0;

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodTabs active={period} />
        <p className="text-sm text-muted-foreground">
          Du {formatBucket(report.start, "day", true)} au {formatBucket(report.end, "day", true)}
        </p>
      </div>

      {empty && (
        <p className="flex items-start gap-2 rounded-lg border bg-background px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Aucune visite enregistrée sur cette période. Les visites du site public sont comptées automatiquement
          (vos propres visites, quand vous êtes connecté à l&apos;administration, ne sont pas comptées).
        </p>
      )}

      <section aria-label="Chiffres clés" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiTile label="Visiteurs" value={n(totals.visitors)} hint="Personnes distinctes, chaque jour" change={changes.visitors} />
        <KpiTile label="Visites" value={n(totals.visits)} hint="Nouvelle visite après 30 min d'inactivité" change={changes.visits} />
        <KpiTile label="Consultations de produits" value={n(totals.productViews)} hint="Fiches produit affichées" change={changes.productViews} />
        <KpiTile label="Clics WhatsApp" value={n(totals.whatsappClicks)} hint="Demandes de prix / contact" change={changes.whatsappClicks} />
        <KpiTile
          label="Taux de contact"
          value={totals.contactRate == null ? "—" : totals.contactRate.toLocaleString("fr-FR")}
          suffix={totals.contactRate == null ? "" : " %"}
          hint="Clics WhatsApp ÷ consultations"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Évolution {bucket === "month" ? "par mois" : "par jour"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-3">
          <TrendChart title="Visites" unitLabel="visites" unit={bucket} points={series.map((s) => ({ bucket: s.bucket, value: s.visits }))} />
          <TrendChart title="Consultations de produits" unitLabel="consultations" unit={bucket} points={series.map((s) => ({ bucket: s.bucket, value: s.productViews }))} />
          <TrendChart title="Clics WhatsApp" unitLabel="clics" unit={bucket} points={series.map((s) => ({ bucket: s.bucket, value: s.whatsappClicks }))} />
          <details className="lg:col-span-3">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">Voir les données en tableau</summary>
            <div className="mt-3 max-h-80 overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">{bucket === "month" ? "Mois" : "Jour"}</th>
                    <th className="px-3 py-2 text-right font-medium">Visiteurs</th>
                    <th className="px-3 py-2 text-right font-medium">Visites</th>
                    <th className="px-3 py-2 text-right font-medium">Consultations</th>
                    <th className="px-3 py-2 text-right font-medium">Clics WhatsApp</th>
                  </tr>
                </thead>
                <tbody className="divide-y tabular-nums">
                  {[...series].reverse().map((s) => (
                    <tr key={s.bucket}>
                      <td className="px-3 py-1.5">{formatBucket(s.bucket, bucket, true)}</td>
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
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Produits les plus consultés</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBars rows={report.topProducts} viewsLabel="Consultations" empty="Aucune fiche produit consultée sur cette période." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Catégories les plus consultées</CardTitle>
          </CardHeader>
          <CardContent>
            <RankedBars rows={report.topCategories} viewsLabel="Consultations (catégorie + fiches)" empty="Aucune catégorie consultée sur cette période." />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Appareils (visites)</CardTitle>
          </CardHeader>
          <CardContent>
            <ShareBars rows={report.devices} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Provenance (visites)</CardTitle>
          </CardHeader>
          <CardContent>
            <ShareBars rows={report.sources} />
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Mesure sans cookie : le visiteur est un identifiant anonyme qui change chaque jour (aucune adresse IP conservée).
        Robots, aperçus de liens et visites de l&apos;administrateur connecté ne sont pas comptés. Données conservées 25 mois.
      </p>
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden>
      <Skeleton className="h-9 w-80" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
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
