// Calcul des statistiques pour /admin/statistiques et le tableau de bord.
// Sans authentification : les pages appellent requireAdmin() AVANT.
// Dates au fuseau du Maroc. Définitions (affichées aussi dans l'interface) :
//  - visiteurs  : personnes distinctes par jour, additionnées sur la période (le hachage change chaque jour) ;
//  - visites    : sessions (30 min d'inactivité = nouvelle visite) ;
//  - consultations : affichages de fiches produit ;
//  - clics WhatsApp : clics sur un bouton WhatsApp (fiche, accueil, pied de page).
import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { moroccoDay, percentChange } from "@/lib/analytics";
import { localMidnightUtc, offsetSegments, toSqlTimestamp } from "@/lib/timezone";

export const PERIODS = {
  "7j": { label: "7 jours", days: 7, bucket: "day" },
  "30j": { label: "30 jours", days: 30, bucket: "day" },
  "90j": { label: "90 jours", days: 90, bucket: "day" },
  "12m": { label: "12 mois", days: 365, bucket: "month" },
} as const;
export type PeriodKey = keyof typeof PERIODS;
export const DEFAULT_PERIOD: PeriodKey = "30j";

export function periodFromUrl(value: string | undefined): PeriodKey {
  return value && value in PERIODS ? (value as PeriodKey) : DEFAULT_PERIOD;
}

const RETENTION_MONTHS = 25; // 2 ans + 1 mois : comparaison d'une année sur l'autre possible

/** Jours (AAAA-MM-JJ, Maroc) de la période et de la période précédente de même durée. */
function ranges(period: PeriodKey, now = new Date()) {
  const { days, bucket } = PERIODS[period];
  const today = moroccoDay(now);
  const shift = (day: string, delta: number) => {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  };
  // 12 mois : du 1er du mois, 11 mois avant, à aujourd'hui (graphique par mois complet).
  const from = bucket === "month" ? `${shift(today, 0).slice(0, 7)}-01` : shift(today, -(days - 1));
  const monthStart = (day: string, monthsBack: number) => {
    const d = new Date(`${day.slice(0, 7)}-01T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - monthsBack);
    return d.toISOString().slice(0, 10);
  };
  const start = bucket === "month" ? monthStart(from, 11) : from;
  const length = Math.round((Date.parse(today) - Date.parse(start)) / 86_400_000) + 1;
  return { start, end: today, previousStart: shift(start, -length), previousEnd: shift(start, -1), bucket };
}

function nextDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Fenêtre de jours (heure du Maroc) prête pour SQL : bornes UTC et expression « date locale ».
 * Le fuseau est calculé par Node (src/lib/timezone.ts) : les données de fuseau de l'image
 * PostgreSQL Alpine sont fausses pour le Maroc (UTC+0 au lieu de UTC+1).
 */
function dayWindow(from: string, to: string) {
  const startUtc = localMidnightUtc(from);
  const endUtc = localMidnightUtc(nextDay(to));
  const segments = offsetSegments(startUtc, endUtc);
  const offset = segments.length === 1
    ? Prisma.sql`${segments[0]!.offsetMinutes}::int * interval '1 minute'`
    : Prisma.sql`CASE ${Prisma.join(
        segments.slice(1).reverse().map((seg) => Prisma.sql`WHEN e.created_at >= ${toSqlTimestamp(seg.from)}::timestamp THEN ${seg.offsetMinutes}::int * interval '1 minute'`),
        " ",
      )} ELSE ${segments[0]!.offsetMinutes}::int * interval '1 minute' END`;
  return {
    /** « créé entre le jour A et le jour B inclus » — utilise l'index sur created_at. */
    where: Prisma.sql`e.created_at >= ${toSqlTimestamp(startUtc)}::timestamp AND e.created_at < ${toSqlTimestamp(endUtc)}::timestamp`,
    /** Date locale (Maroc) de l'événement. */
    localDate: Prisma.sql`(e.created_at + ${offset})::date`,
  };
}

type Totals = { visitors: number; visits: number; pageViews: number; productViews: number; whatsappClicks: number };

/** Filtre facultatif « catégorie » : seuls les événements liés à cette catégorie (vues, fiches, clics). */
function categoryFilter(categoryId: string | null) {
  return categoryId ? Prisma.sql`AND e.category_id = ${categoryId}::uuid` : Prisma.empty;
}

async function totals(from: string, to: string, categoryId: string | null = null): Promise<Totals> {
  const { where, localDate } = dayWindow(from, to);
  const [row] = await prisma.$queryRaw<{ visitors: bigint; visits: bigint; page_views: bigint; product_views: bigint; whatsapp_clicks: bigint }[]>`
    SELECT count(DISTINCT e.visitor_hash || ':' || ${localDate}::text) AS visitors,
           count(DISTINCT e.session_id) AS visits,
           count(*) FILTER (WHERE e.type = 'PAGE_VIEW') AS page_views,
           count(*) FILTER (WHERE e.type = 'PRODUCT_VIEW') AS product_views,
           count(*) FILTER (WHERE e.type = 'WHATSAPP_CLICK') AS whatsapp_clicks
    FROM analytics_events e WHERE ${where} ${categoryFilter(categoryId)}`;
  return {
    visitors: Number(row?.visitors ?? 0),
    visits: Number(row?.visits ?? 0),
    pageViews: Number(row?.page_views ?? 0),
    productViews: Number(row?.product_views ?? 0),
    whatsappClicks: Number(row?.whatsapp_clicks ?? 0),
  };
}

export type SeriesPoint = { bucket: string; visitors: number; visits: number; productViews: number; whatsappClicks: number };
export type RankedRow = { id: string | null; name: string; href: string | null; views: number; clicks: number };
export type ShareRow = { label: string; value: number };

export type StatsReport = {
  period: PeriodKey;
  categoryId: string | null;
  start: string;
  end: string;
  bucket: "day" | "month";
  totals: Totals & { contactRate: number | null };
  changes: Record<keyof Totals, number | null>;
  series: SeriesPoint[];
  topProducts: RankedRow[];
  topCategories: RankedRow[];
  devices: ShareRow[];
  sources: ShareRow[];
};

export async function getStatsReport(period: PeriodKey, categoryId: string | null = null): Promise<StatsReport> {
  // Données plus anciennes que la durée de conservation : supprimées (minimisation des données).
  await prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_MONTHS * 31 * 86_400_000) } } });

  const r = ranges(period);
  const step = r.bucket === "month" ? Prisma.sql`'1 month'::interval` : Prisma.sql`'1 day'::interval`;
  const { where: inRange, localDate } = dayWindow(r.start, r.end);
  const trunc = r.bucket === "month" ? Prisma.sql`date_trunc('month', ${localDate})::date` : localDate;

  const cat = categoryFilter(categoryId);
  const [current, previous, series, products, categories, devices, sources] = await Promise.all([
    totals(r.start, r.end, categoryId),
    totals(r.previousStart, r.previousEnd, categoryId),
    prisma.$queryRaw<{ bucket: Date; visitors: bigint; visits: bigint; product_views: bigint; whatsapp_clicks: bigint }[]>`
      WITH buckets AS (
        SELECT generate_series(${r.start}::date, ${r.end}::date, ${step})::date AS bucket
      ), counts AS (
        SELECT ${trunc} AS bucket,
               count(DISTINCT e.visitor_hash || ':' || ${localDate}::text) AS visitors,
               count(DISTINCT e.session_id) AS visits,
               count(*) FILTER (WHERE e.type = 'PRODUCT_VIEW') AS product_views,
               count(*) FILTER (WHERE e.type = 'WHATSAPP_CLICK') AS whatsapp_clicks
        FROM analytics_events e WHERE ${inRange} ${cat}
        GROUP BY 1
      )
      SELECT b.bucket, coalesce(c.visitors, 0) AS visitors, coalesce(c.visits, 0) AS visits,
             coalesce(c.product_views, 0) AS product_views, coalesce(c.whatsapp_clicks, 0) AS whatsapp_clicks
      FROM buckets b LEFT JOIN counts c USING (bucket) ORDER BY b.bucket`,
    prisma.$queryRaw<{ id: string | null; name: string | null; slug: string | null; views: bigint; clicks: bigint }[]>`
      SELECT e.product_id AS id, p.name, p.slug,
             count(*) FILTER (WHERE e.type = 'PRODUCT_VIEW') AS views,
             count(*) FILTER (WHERE e.type = 'WHATSAPP_CLICK') AS clicks
      FROM analytics_events e LEFT JOIN products p ON p.id = e.product_id
      WHERE ${inRange} ${cat} AND e.product_id IS NOT NULL AND e.type IN ('PRODUCT_VIEW', 'WHATSAPP_CLICK')
      GROUP BY e.product_id, p.name, p.slug
      ORDER BY views DESC, clicks DESC LIMIT 10`,
    prisma.$queryRaw<{ id: string | null; name: string | null; slug: string | null; views: bigint; clicks: bigint }[]>`
      SELECT e.category_id AS id, c.name, c.slug,
             count(*) FILTER (WHERE e.type IN ('CATEGORY_VIEW', 'PRODUCT_VIEW')) AS views,
             count(*) FILTER (WHERE e.type = 'WHATSAPP_CLICK') AS clicks
      FROM analytics_events e LEFT JOIN categories c ON c.id = e.category_id
      WHERE ${inRange} ${cat} AND e.category_id IS NOT NULL
      GROUP BY e.category_id, c.name, c.slug
      ORDER BY views DESC, clicks DESC LIMIT 10`,
    prisma.$queryRaw<{ label: string | null; value: bigint }[]>`
      SELECT e.device_type AS label, count(DISTINCT e.session_id) AS value
      FROM analytics_events e WHERE ${inRange} ${cat} GROUP BY 1 ORDER BY 2 DESC`,
    prisma.$queryRaw<{ label: string | null; value: bigint }[]>`
      SELECT first.referrer AS label, count(*) AS value FROM (
        SELECT DISTINCT ON (e.session_id) e.session_id, e.referrer
        FROM analytics_events e WHERE ${inRange} AND e.type = 'PAGE_VIEW'
          ${categoryId ? Prisma.sql`AND e.session_id IN (SELECT e2.session_id FROM analytics_events e2 WHERE e2.category_id = ${categoryId}::uuid)` : Prisma.empty}
        ORDER BY e.session_id, e.created_at
      ) first GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
  ]);

  const deviceLabels: Record<string, string> = { mobile: "Téléphone", tablet: "Tablette", desktop: "Ordinateur" };
  const ranked = (rows: typeof products, path: "produits" | "categories", fallback: string): RankedRow[] =>
    rows.map((row) => ({
      id: row.id,
      name: row.name ?? fallback,
      href: row.slug ? `/${path}/${row.slug}` : null,
      views: Number(row.views),
      clicks: Number(row.clicks),
    }));

  return {
    period,
    categoryId,
    start: r.start,
    end: r.end,
    bucket: r.bucket,
    totals: { ...current, contactRate: current.productViews ? Math.round((current.whatsappClicks / current.productViews) * 1000) / 10 : null },
    changes: {
      visitors: percentChange(current.visitors, previous.visitors),
      visits: percentChange(current.visits, previous.visits),
      pageViews: percentChange(current.pageViews, previous.pageViews),
      productViews: percentChange(current.productViews, previous.productViews),
      whatsappClicks: percentChange(current.whatsappClicks, previous.whatsappClicks),
    },
    series: series.map((s) => ({
      bucket: s.bucket.toISOString().slice(0, 10),
      visitors: Number(s.visitors),
      visits: Number(s.visits),
      productViews: Number(s.product_views),
      whatsappClicks: Number(s.whatsapp_clicks),
    })),
    topProducts: ranked(products, "produits", "Produit supprimé"),
    topCategories: ranked(categories, "categories", "Catégorie supprimée"),
    devices: devices.map((d) => ({ label: deviceLabels[d.label ?? ""] ?? "Inconnu", value: Number(d.value) })),
    sources: sources.map((s) => ({ label: s.label ?? "Accès direct / application", value: Number(s.value) })),
  };
}

/** Résumé des 7 derniers jours pour le tableau de bord. */
export async function getWeekSummary(): Promise<Totals & { changes: Record<keyof Totals, number | null> }> {
  const r = ranges("7j");
  const [current, previous] = await Promise.all([totals(r.start, r.end), totals(r.previousStart, r.previousEnd)]);
  return {
    ...current,
    changes: {
      visitors: percentChange(current.visitors, previous.visitors),
      visits: percentChange(current.visits, previous.visits),
      pageViews: percentChange(current.pageViews, previous.pageViews),
      productViews: percentChange(current.productViews, previous.productViews),
      whatsappClicks: percentChange(current.whatsappClicks, previous.whatsappClicks),
    },
  };
}
