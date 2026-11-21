// Filtres par catégorie : pastilles qui défilent horizontalement sur mobile.
// La recherche en cours (q) est conservée quand on change de catégorie.
import Link from "next/link";
import { CategoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";
import type { PublicCategory } from "@/server/catalogue/queries";

export function CategoryChips({ categories, activeSlug, q }: { categories: PublicCategory[]; activeSlug: string | null; q: string }) {
  const withQuery = (path: string) => (q ? `${path}?q=${encodeURIComponent(q)}` : path);
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]",
      active
        ? "border-transparent bg-[var(--brand)] text-[var(--brand-foreground)]"
        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400",
    );
  return (
    <nav aria-label="Catégories" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      <ul className="flex gap-2 pb-1 sm:flex-wrap">
        <li>
          <Link href={withQuery("/produits")} className={chip(activeSlug === null)} aria-current={activeSlug === null ? "page" : undefined}>
            Tous
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.id}>
            <Link href={withQuery(`/categories/${c.slug}`)} className={chip(activeSlug === c.slug)} aria-current={activeSlug === c.slug ? "page" : undefined}>
              <CategoryIcon icon={c.icon} className="size-4" />
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
