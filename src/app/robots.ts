// /robots.txt : Google indexe le site public, jamais l'administration ni les fichiers techniques.
import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { absoluteUrl } from "@/lib/site-url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection(); // SITE_URL lue au démarrage du serveur, pas à la compilation
  const sitemap = absoluteUrl("/sitemap.xml");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
    ...(sitemap ? { sitemap } : {}),
  };
}
