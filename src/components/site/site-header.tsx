// En-tête du site public (mobile d'abord) :
//   mobile  : ☰  Logo/Nom ........................ Catalogue
//             [ Rechercher un produit…          ]
//   ordinateur : Logo/Nom   [ Rechercher… ]   Catalogue  Catégories (liens)
import Link from "next/link";
import { mediaUrl } from "@/lib/media";
import type { PublicCategory, PublicSettings } from "@/server/catalogue/queries";
import { MobileMenu } from "./mobile-menu";
import { SearchBox } from "./search-box";

export function SiteHeader({ settings, categories }: { settings: PublicSettings; categories: PublicCategory[] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-backdrop-filter:bg-white/85">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:gap-4">
        <MobileMenu storeName={settings.storeName} categories={categories} />
        <Link href="/" className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--brand)]">
          {settings.logoKey && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(settings.logoKey, 128)} alt="" width={36} height={36} className="size-9 shrink-0 object-contain" />
          )}
          <span className="truncate text-lg font-semibold tracking-tight text-slate-900">{settings.storeName}</span>
        </Link>
        <div className="ml-auto hidden w-full max-w-md md:block">
          <SearchBox />
        </div>
        <nav aria-label="Navigation principale" className="ml-auto md:ml-0">
          <Link
            href="/produits"
            className="inline-flex h-10 items-center rounded-full bg-[var(--brand)] px-4 text-sm font-medium text-[var(--brand-foreground)] shadow-sm transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          >
            Catalogue
          </Link>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-2.5 md:hidden">
        <SearchBox />
      </div>
    </header>
  );
}
