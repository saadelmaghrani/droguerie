// Mise en page du SITE PUBLIC (groupe de routes « (site) » : n'apparaît pas dans l'URL).
// Les données viennent de lectures mises en cache (src/server/catalogue/queries.ts) ;
// connection() : rendu à la demande, jamais pendant la compilation (la base n'y est pas accessible).
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense, type CSSProperties } from "react";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { readableTextColor } from "@/lib/color";
import { getPublicCategories, getPublicSettings } from "@/server/catalogue/queries";

export async function generateMetadata(): Promise<Metadata> {
  await connection();
  const s = await getPublicSettings();
  return {
    title: { default: s.seoTitle ?? s.storeName, template: `%s · ${s.storeName}` },
    description: s.seoDescription ?? `Catalogue de ${s.storeName} : demandez le prix sur WhatsApp.`,
    openGraph: { siteName: s.storeName, locale: "fr_MA", type: "website" },
  };
}

async function SiteShell({ children }: { children: React.ReactNode }) {
  await connection();
  const [settings, categories] = await Promise.all([getPublicSettings(), getPublicCategories()]);
  // Couleur principale choisie dans les Paramètres, texte lisible calculé (contraste WCAG).
  const brand = { "--brand": settings.primaryColor, "--brand-foreground": readableTextColor(settings.primaryColor) } as CSSProperties;
  return (
    <div style={brand} className="flex min-h-screen flex-col bg-white text-slate-900">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow">
        Aller au contenu
      </a>
      <SiteHeader settings={settings} categories={categories} />
      <main id="contenu" className="flex-1">{children}</main>
      <SiteFooter settings={settings} categories={categories} />
    </div>
  );
}

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" aria-busy="true" />}>
      <SiteShell>{children}</SiteShell>
    </Suspense>
  );
}
