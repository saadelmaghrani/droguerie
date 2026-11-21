import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, FileText, MessageCircle, Package, Tags, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/dal";
import { PageHeader } from "./_components/page-header";

export const metadata: Metadata = { title: "Tableau de bord" };

type Stat = { label: string; value: number; hint: string; href: string; icon: LucideIcon };

async function DashboardContent() {
  const admin = await requireAdmin(); // vérification complète en base, AVANT toute lecture

  const [statusCounts, categories, activeWhatsappNumbers] = await Promise.all([
    prisma.product.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.category.count(),
    prisma.whatsappNumber.count({ where: { isActive: true } }),
  ]);
  const countFor = (status: "PUBLISHED" | "DRAFT" | "HIDDEN") =>
    statusCounts.find((row) => row.status === status)?._count._all ?? 0;

  const stats: Stat[] = [
    { label: "Produits publiés", value: countFor("PUBLISHED"), hint: "Visibles sur le site", href: "/admin/produits", icon: Package },
    { label: "Brouillons", value: countFor("DRAFT"), hint: "En attente de publication", href: "/admin/produits", icon: FileText },
    { label: "Catégories", value: categories, hint: "Organisation du catalogue", href: "/admin/categories", icon: Tags },
    { label: "Numéros WhatsApp", value: activeWhatsappNumbers, hint: "Numéros actifs", href: "/admin/whatsapp", icon: MessageCircle },
  ];

  return (
    <>
      <p className="-mt-6 mb-8 text-sm text-muted-foreground">
        Bonjour {admin.name}, voici l&apos;état actuel du catalogue.
      </p>
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
      <p className="mt-6 text-xs text-muted-foreground">
        Les statistiques de visite (visiteurs, consultations, clics WhatsApp) arriveront en semaine 5.
      </p>
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
