// Catalogue (tous les produits ou une catégorie) : recherche, filtres, grille, pagination.
// Les filtres sont dans l'URL (?q=…&page=…) : liens partageables, bouton retour fonctionnel.
import Link from "next/link";
import { ChevronLeft, ChevronRight, SearchX } from "lucide-react";
import { searchCatalogue, type PublicCategory } from "@/server/catalogue/queries";
import { CategoryChips } from "./category-chips";
import { ProductGrid } from "./product-card";
import { SearchBox } from "./search-box";

export async function CatalogueView({
  q,
  page,
  category,
  categories,
}: {
  q: string;
  page: number;
  category: PublicCategory | null;
  categories: PublicCategory[];
}) {
  const basePath = category ? `/categories/${category.slug}` : "/produits";
  const result = await searchCatalogue({ q, categoryId: category?.id ?? null, page });
  const href = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const query = params.toString();
    return `${basePath}${query ? `?${query}` : ""}`;
  };
  const title = category ? category.name : q ? `Résultats pour « ${q} »` : "Tous les produits";

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 sm:py-8">
      <div className="grid gap-1">
        {category && (
          <nav aria-label="Fil d'Ariane" className="text-sm text-slate-500">
            <Link href="/" className="hover:underline">Accueil</Link> › <Link href="/produits" className="hover:underline">Catalogue</Link>
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        {category?.description && <p className="max-w-2xl text-slate-600">{category.description}</p>}
      </div>

      <div className="grid gap-3">
        <div className="max-w-xl">
          <SearchBox
            action={basePath}
            defaultValue={q}
            placeholder={category ? `Rechercher dans ${category.name}…` : "Rechercher un produit…"}
            size="lg"
          />
        </div>
        <CategoryChips categories={categories} activeSlug={category?.slug ?? null} q={q} />
      </div>

      <p className="text-sm text-slate-600" aria-live="polite">
        {result.total === 0
          ? ""
          : `${result.total.toLocaleString("fr-FR")} produit${result.total > 1 ? "s" : ""}${q ? ` pour « ${q} »` : ""}`}
        {q && result.total > 0 && (
          <>
            {" · "}
            <Link href={basePath} className="underline">Effacer la recherche</Link>
          </>
        )}
      </p>

      {result.rows.length > 0 ? (
        <ProductGrid products={result.rows} priorityCount={page === 1 ? 4 : 0} />
      ) : (
        <div className="grid justify-items-center gap-3 rounded-3xl bg-slate-50 px-6 py-12 text-center ring-1 ring-slate-200">
          <SearchX className="size-8 text-slate-400" aria-hidden />
          <p className="font-medium text-slate-900">{result.total > 0 ? "Cette page n'existe pas." : "Aucun produit trouvé."}</p>
          <p className="max-w-sm text-sm text-slate-600">
            {result.total > 0
              ? "Revenez à la première page des résultats."
              : q
                ? "Vérifiez l'orthographe ou essayez un mot plus général. Vous pouvez aussi nous demander directement sur WhatsApp."
                : "Aucun produit dans cette catégorie pour le moment."}
          </p>
          <Link href={result.total > 0 ? href(1) : "/produits"} className="text-sm font-medium underline">
            {result.total > 0 ? "Première page" : "Voir tout le catalogue"}
          </Link>
        </div>
      )}

      {result.pageCount > 1 && result.rows.length > 0 && (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-2 pt-2">
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev" className="inline-flex h-10 items-center gap-1 rounded-full border border-slate-300 px-4 text-sm font-medium hover:border-slate-400">
              <ChevronLeft className="size-4" aria-hidden /> Précédent
            </Link>
          ) : <span />}
          <span className="text-sm text-slate-600" aria-current="page">Page {page} sur {result.pageCount}</span>
          {page < result.pageCount ? (
            <Link href={href(page + 1)} rel="next" className="inline-flex h-10 items-center gap-1 rounded-full border border-slate-300 px-4 text-sm font-medium hover:border-slate-400">
              Suivant <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}

export function CatalogueSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
      <div className="h-12 max-w-xl animate-pulse rounded-full bg-slate-100" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
    </div>
  );
}

/** Paramètres d'URL validés : valeur inconnue = ignorée. */
export function readCatalogueParams(sp: Record<string, string | string[] | undefined>) {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  return {
    q: first(sp.q).trim().slice(0, 100),
    page: Math.max(1, Math.min(1000, Number.parseInt(first(sp.page), 10) || 1)),
  };
}
