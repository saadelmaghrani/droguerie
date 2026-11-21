import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, FileUp, Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { statusFromUrl, STATUS_INFO } from "@/lib/product-status";
import { requireAdmin } from "@/server/auth/dal";
import { listCategoryOptions, listProducts } from "@/server/products/service";
import { PageHeader } from "../_components/page-header";
import { ProductFilters } from "./_components/product-filters";
import { ProductsTable } from "./_components/products-table";

export const metadata: Metadata = { title: "Produits" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function ProductsContent({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin(); // 1. vérification de la session, AVANT la lecture des données
  const sp = await searchParams;

  // Paramètres d'URL validés : une valeur inconnue est simplement ignorée.
  const q = first(sp.q).slice(0, 100);
  const categoryId = UUID.test(first(sp.categorie)) ? first(sp.categorie) : "";
  const status = statusFromUrl(first(sp.statut));
  const requestedPage = Math.max(1, Math.min(10_000, Number.parseInt(first(sp.page), 10) || 1));

  const [list, categories] = await Promise.all([
    listProducts({ q, categoryId: categoryId || null, status, page: requestedPage }),
    listCategoryOptions(),
  ]);
  const filtered = Boolean(q || categoryId || status);
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (categoryId) params.set("categorie", categoryId);
    if (status) params.set("statut", STATUS_INFO[status].url);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return `/admin/produits${query ? `?${query}` : ""}`;
  };

  return (
    <div className="grid gap-4">
      {/* key : les champs se remettent à jour quand l'URL change (ex. « Effacer »). */}
      <ProductFilters
        key={`${q}|${categoryId}|${status}`}
        q={q}
        categoryId={categoryId}
        statusUrl={status ? STATUS_INFO[status].url : ""}
        categories={categories}
      />

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {list.total === 0
          ? filtered ? "Aucun produit ne correspond à ces critères." : ""
          : `${list.total.toLocaleString("fr-FR")} produit${list.total > 1 ? "s" : ""}${filtered ? " trouvé" + (list.total > 1 ? "s" : "") : ""}`}
      </p>

      {list.total === 0 && !filtered ? (
        <Card>
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Package className="size-6" aria-hidden />
            </span>
            <h2 className="font-semibold">Aucun produit</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Créez votre premier produit.</p>
            <Button asChild className="mt-6">
              <Link href="/admin/produits/nouveau">
                <Plus className="size-4" aria-hidden />
                Nouveau produit
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : list.rows.length > 0 ? (
        <ProductsTable rows={list.rows} />
      ) : list.total > 0 ? (
        <p className="text-sm">
          Cette page n&apos;existe pas. <Link className="underline" href={pageHref(1)}>Revenir à la première page</Link>
        </p>
      ) : null}

      {list.pageCount > 1 && list.rows.length > 0 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" asChild={list.page > 1} disabled={list.page <= 1}>
            {list.page > 1 ? (
              <Link href={pageHref(list.page - 1)} rel="prev">
                <ChevronLeft className="size-4" aria-hidden />
                Précédent
              </Link>
            ) : (
              <span><ChevronLeft className="size-4" aria-hidden />Précédent</span>
            )}
          </Button>
          <span className="text-sm text-muted-foreground" aria-current="page">
            Page {list.page} sur {list.pageCount}
          </span>
          <Button variant="outline" size="sm" asChild={list.page < list.pageCount} disabled={list.page >= list.pageCount}>
            {list.page < list.pageCount ? (
              <Link href={pageHref(list.page + 1)} rel="next">
                Suivant
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ) : (
              <span>Suivant<ChevronRight className="size-4" aria-hidden /></span>
            )}
          </Button>
        </nav>
      )}
    </div>
  );
}

function ProductsSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden>
      <Skeleton className="h-14 rounded-xl" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

export default function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Produits"
        description="Recherchez, créez et publiez les produits du catalogue."
        actions={
          <>
          <Button variant="outline" asChild>
            <Link href="/admin/produits/import">
              <FileUp className="size-4" aria-hidden />
              Importer
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/produits/nouveau">
              <Plus className="size-4" aria-hidden />
              Nouveau produit
            </Link>
          </Button>
          </>
        }
      />
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductsContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
