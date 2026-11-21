// Plan du site pour Google : /sitemap.xml (pages publiques visibles uniquement).
// Nécessite SITE_URL (adresse publique) ; sans elle, le plan est vide.
import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { absoluteUrl } from "@/lib/site-url";
import { getSitemapEntries } from "@/server/catalogue/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // lu à la demande (la base n'est pas accessible pendant la compilation)
  const home = absoluteUrl("/");
  if (!home) return [];
  const { products, categories } = await getSitemapEntries();
  return [
    { url: home, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/produits")!, changeFrequency: "daily", priority: 0.9 },
    ...categories.map((slug) => ({ url: absoluteUrl(`/categories/${slug}`)!, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.map((p) => ({ url: absoluteUrl(`/produits/${p.slug}`)!, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
