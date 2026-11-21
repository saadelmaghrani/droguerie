import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, FileText, MessageCircle, Package, Tags, TriangleAlert, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { prisma } from "@/lib/prisma";
import { getWeekSummary } from "@/server/analytics/stats";
import { requireAdmin } from "@/server/auth/dal";
import { PageHeader } from "./_components/page-header";

export const metadata: Metadata = { title: "Tableau de bord" };

type Stat = { label: string; value: number; hint: string; href: string; icon: LucideIcon };

async function DashboardContent() {
  const admin = await requireAdmin(); // vérification complète en base, AVANT toute lecture

  const [statusCounts, categories, activeWhatsappNumbers, week, publishedWithoutPhoto] = await Promise.all([
    prisma.product.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.category.count(),
    prisma.whatsappNumber.count({ where: { isActive: true } }),
    getWeekSummary(),
    prisma.product.count({ where: { status: "PUBLISHED", images: { none: { position: 0 } } } }),
  ]);
  const countFor = (status: "PUBLISHED" | "DRAFT" | "HIDDEN") =>
    statusCounts.find((row) => row.status === status)?._count._all ?? 0;

  const stats: Stat[] = [
    { label: "Produits publiés", value: countFor("PUBLISHED"), hint: "Visibles sur le site", href: "/admin/produits?statut=publie", icon: Package },
    { label: "Brouillons", value: countFor("DRAFT"), hint: "En attente de publication", href: "/admin/produits?statut=brouillon", icon: FileText },
    { label: "Catégories", value: categories, hint: "Organisation du catalogue", href: "/admin/categories", icon: Tags },
    { label: "Numéros WhatsApp", value: activeWhatsappNumbers, hint: "Numéros actifs", href: "/admin/whatsapp", icon: MessageCircle },
  ];

  return (
    <>
      <p className="-mt-6 mb-8 text-sm text-muted-foreground">
        Bonjour {admin.name}, voici l&apos;état actuel du catalogue.
      </p>
      {publishedWithoutPhoto > 0 && (
        <Link
          href="/admin/produits?statut=publie&photo=sans"
          className="mb-6 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 hover:bg-amber-100"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong>{publishedWithoutPhoto} produit{publishedWithoutPhoto > 1 ? "s" : ""} publié{publishedWithoutPhoto > 1 ? "s" : ""} sans photo</strong> :
            le site affiche une image par défaut. Ajoutez leur photo principale →
          </span>
        </Link>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, hint, href, icon: Icon }) => (
          <Link
            key={label}
            href={href}
            className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">{label}</span>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" aria-hidden />
                  </span>
                </div>
                <span className="text-3xl font-semibold tabular-nums tracking-tight">
                  {value.toLocaleString("fr-FR")}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {hint}
                  <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <section aria-labelledby="week" className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="week" className="text-base font-semibold">Les 7 derniers jours</h2>
          <Link href="/admin/statistiques?periode=7j" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline">
            Statistiques détaillées
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Visites", value: week.visits, change: week.changes.visits },
            { label: "Consultations de produits", value: week.productViews, change: week.changes.productViews },
            { label: "Clics WhatsApp", value: week.whatsappClicks, change: week.changes.whatsappClicks },
          ].map(({ label, value, change }) => (
            <Card key={label}>
              <CardContent className="grid gap-1">
                <span className="text-sm font-medium text-muted-foreground">{label}</span>
                <span className="text-3xl font-semibold tabular-nums tracking-tight">{value.toLocaleString("fr-FR")}</span>
                <span className="text-xs text-muted-foreground">
                  {change == null ? "Pas de comparaison possible" : `${change > 0 ? "+" : ""}${change} % vs 7 jours précédents`}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-hidden>
      <Skeleton className="-mt-6 mb-8 h-4 w-72" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Tableau de bord" />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}
