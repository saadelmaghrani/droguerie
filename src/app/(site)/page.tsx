// Accueil : bannière + recherche, catégories, produits mis en avant, nouveautés, présentation.
// Chaque bloc vide (texte non renseigné, aucun produit) est masqué.
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ArrowRight, Clock, MapPin } from "lucide-react";
import { CategoryTiles } from "@/components/site/category-tiles";
import { ProductGrid } from "@/components/site/product-card";
import { SearchBox } from "@/components/site/search-box";
import { WhatsappIcon } from "@/components/site/whatsapp-icon";
import { mediaSrcSet, mediaUrl } from "@/lib/media";
import { whatsappUrl } from "@/lib/phone";
import {
  getFeaturedProducts,
  getNewArrivals,
  getPublicCategories,
  getPublicSettings,
} from "@/server/catalogue/queries";

function SectionTitle({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline">
          {linkLabel}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}
    </div>
  );
}

async function HomeContent() {
  await connection();
  const [settings, categories, featured, newest] = await Promise.all([
    getPublicSettings(),
    getPublicCategories(),
    getFeaturedProducts(8),
    getNewArrivals(8),
  ]);
  const showFeatured = settings.showFeatured && featured.length > 0;
  const showNew = settings.showNewArrivals && newest.length > 0;
  const hasInfo = settings.aboutText || settings.address || settings.openingHours || settings.mapsEmbedUrl;

  return (
    <>
      {/* Bannière */}
      <section className="relative isolate overflow-hidden bg-slate-900 text-white">
        {settings.heroImageKey && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(settings.heroImageKey, 1600)}
            srcSet={mediaSrcSet(settings.heroImageKey, "hero")}
            sizes="100vw"
            alt=""
            fetchPriority="high"
            className="absolute inset-0 -z-10 size-full object-cover opacity-45"
          />
        )}
        {!settings.heroImageKey && <div className="absolute inset-0 -z-10 bg-[var(--brand)] opacity-90" aria-hidden />}
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-12 sm:py-20">
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            {settings.heroTitle ?? settings.storeName}
          </h1>
          {settings.heroSubtitle && <p className="max-w-xl text-base text-white/85 sm:text-lg">{settings.heroSubtitle}</p>}
          <div className="grid max-w-xl gap-3 text-slate-900">
            <SearchBox size="lg" placeholder="Que recherchez-vous ? (ex. peinture, éponge…)" />
          </div>
          {settings.heroCtaLabel && (
            <Link
              href="/produits"
              className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-100"
            >
              {settings.heroCtaLabel}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-10">
        {categories.length > 0 && (
          <section aria-labelledby="cats">
            <h2 id="cats" className="mb-4 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Nos catégories</h2>
            <CategoryTiles categories={categories} />
          </section>
        )}

        {showFeatured && (
          <section>
            <SectionTitle title="Produits mis en avant" href="/produits" linkLabel="Tout voir" />
            <ProductGrid products={featured} priorityCount={2} />
          </section>
        )}

        {showNew && (
          <section>
            <SectionTitle title="Nouveautés" href="/produits" linkLabel="Tout le catalogue" />
            <ProductGrid products={newest} />
          </section>
        )}

        {categories.length === 0 && (
          <p className="rounded-2xl bg-slate-50 p-8 text-center text-slate-600">Le catalogue est en cours de préparation. Revenez bientôt !</p>
        )}

        {settings.defaultWhatsapp && (
          <section className="grid gap-4 rounded-3xl bg-slate-50 p-6 ring-1 ring-slate-200 sm:grid-cols-[1fr_auto] sm:items-center sm:p-8">
            <div className="grid gap-1">
              <h2 className="text-lg font-semibold text-slate-900">Un prix, une disponibilité, un conseil ?</h2>
              <p className="text-sm text-slate-600">Écrivez-nous directement sur WhatsApp, nous vous répondons rapidement.</p>
            </div>
            <a
              href={whatsappUrl(settings.defaultWhatsapp, `Bonjour ${settings.storeName}, j'ai une question.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 font-semibold text-slate-900 shadow-sm hover:bg-[#1ebe5b]"
            >
              <WhatsappIcon className="size-5" />
              Écrire sur WhatsApp
            </a>
          </section>
        )}

        {hasInfo && (
          <section aria-labelledby="about" className="grid gap-6 lg:grid-cols-2">
            <div className="grid content-start gap-4">
              <h2 id="about" className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Le magasin</h2>
              {settings.aboutText && <p className="whitespace-pre-line leading-relaxed text-slate-700">{settings.aboutText}</p>}
              <ul className="grid gap-2 text-sm text-slate-700">
                {settings.address && <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /><span className="whitespace-pre-line">{settings.address}</span></li>}
                {settings.openingHours && <li className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0" aria-hidden /><span className="whitespace-pre-line">{settings.openingHours}</span></li>}
              </ul>
            </div>
            {settings.mapsEmbedUrl && (
              <iframe
                src={settings.mapsEmbedUrl}
                title={`Plan d'accès — ${settings.storeName}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="aspect-[4/3] w-full rounded-2xl border-0 ring-1 ring-slate-200"
              />
            )}
          </section>
        )}
      </div>
    </>
  );
}

function HomeSkeleton() {
  return (
    <div aria-busy="true">
      <div className="h-72 animate-pulse bg-slate-200" />
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 px-4 py-10 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-square animate-pulse rounded-2xl bg-slate-100" />)}
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}
