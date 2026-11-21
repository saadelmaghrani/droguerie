// Catalogue complet : /produits?q=…&page=…
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CatalogueSkeleton, CatalogueView, readCatalogueParams } from "@/components/site/catalogue-view";
import { getPublicCategories } from "@/server/catalogue/queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata: Metadata = {
  title: "Catalogue",
  description: "Tous nos produits : entretien, peinture, quincaillerie, outillage. Prix sur demande via WhatsApp.",
};

async function Content({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const { q, page } = readCatalogueParams(await searchParams);
  const categories = await getPublicCategories();
  return <CatalogueView q={q} page={page} category={null} categories={categories} />;
}

export default function CataloguePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<CatalogueSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
