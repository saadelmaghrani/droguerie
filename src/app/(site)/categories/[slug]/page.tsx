// Catalogue d'une catégorie : /categories/<adresse>?q=…&page=…
// Catégorie masquée, vide ou inconnue → page introuvable (règle de visibilité).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CatalogueSkeleton, CatalogueView, readCatalogueParams } from "@/components/site/catalogue-view";
import { getPublicCategories } from "@/server/catalogue/queries";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function findCategory(slug: string) {
  return (await getPublicCategories()).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  await connection();
  const category = await findCategory((await params).slug);
  if (!category) return { title: "Catégorie introuvable" };
  return {
    title: category.name,
    description: category.description ?? `${category.name} : ${category.productCount} produits. Prix sur demande via WhatsApp.`,
  };
}

async function Content({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  await connection();
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const categories = await getPublicCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();
  const { q, page } = readCatalogueParams(sp);
  return <CatalogueView q={q} page={page} category={category} categories={categories} />;
}

export default function CategoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  return (
    <Suspense fallback={<CatalogueSkeleton />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}
