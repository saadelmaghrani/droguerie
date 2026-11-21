// Fiche produit publique : /produits/<adresse>
// Brouillon, produit masqué ou catégorie masquée → page introuvable (règle de visibilité).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { ProductDetail } from "@/components/catalogue/product-detail";
import { ProductGrid } from "@/components/site/product-card";
import { mediaUrl } from "@/lib/media";
import { absoluteUrl } from "@/lib/site-url";
import { getPublicProduct, getRelatedProducts } from "@/server/catalogue/queries";

type Params = Promise<{ slug: string }>;

/** Description courte pour Google et les aperçus de partage (≈ 155 caractères, coupée sur un mot). */
function excerpt(text: string | null, fallback: string): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (!clean) return fallback;
  return clean.length <= 155 ? clean : `${clean.slice(0, 152).replace(/\s+\S*$/, "")}…`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  await connection();
  const product = await getPublicProduct((await params).slug);
  if (!product) return { title: "Produit introuvable", robots: { index: false } };
  const description = excerpt(product.description, `${product.name} — ${product.category.name}. Prix et disponibilité sur demande via WhatsApp.`);
  const image = product.images[0];
  return {
    title: product.name,
    description,
    alternates: { canonical: `/produits/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      type: "website",
      ...(image ? { images: [{ url: mediaUrl(image.storageKey, 1600), width: image.width, height: image.height, alt: product.name }] } : {}),
    },
  };
}

async function Related({ categoryId, excludeId, categorySlug, categoryName }: { categoryId: string; excludeId: string; categorySlug: string; categoryName: string }) {
  const related = await getRelatedProducts(categoryId, excludeId, 4);
  if (related.length === 0) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 pb-4">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Dans la même catégorie</h2>
        <Link href={`/categories/${categorySlug}`} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-slate-700 hover:underline">
          {categoryName}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <ProductGrid products={related} />
    </section>
  );
}

async function Content({ params }: { params: Params }) {
  await connection();
  const product = await getPublicProduct((await params).slug);
  if (!product) notFound();
  return (
    <>
      <ProductDetail product={product} productUrl={absoluteUrl(`/produits/${product.slug}`)} />
      <Related categoryId={product.categoryId} excludeId={product.id} categorySlug={product.category.slug} categoryName={product.category.name} />
    </>
  );
}

function ProductSkeleton() {
  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-6 lg:grid-cols-2 lg:py-10" aria-busy="true">
      <div className="aspect-square animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid content-start gap-4">
        <div className="h-8 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-24 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function ProductPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}
