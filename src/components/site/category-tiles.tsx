"use client";

// Tuiles « Nos catégories » de l'accueil : 4 au départ, bouton « Voir plus » pour tout afficher.
// Toutes les tuiles sont dans le HTML (liens lus par Google) ; au-delà de 4, elles sont masquées
// tant que le visiteur n'a pas déplié la liste. Pas de bouton s'il y a 4 catégories ou moins.
import Link from "next/link";
import { useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CategoryIcon } from "@/lib/category-icons";
import { mediaUrl } from "@/lib/media";
import type { PublicCategory } from "@/server/catalogue/queries";

export const INITIAL_CATEGORIES = 4;

export function CategoryTiles({ categories }: { categories: PublicCategory[] }) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const hiddenCount = categories.length - INITIAL_CATEGORIES;

  function toggle() {
    setExpanded((open) => !open);
    // « Voir moins » : si le haut de la liste est sorti de l'écran, on y revient.
    if (expanded && listRef.current && listRef.current.getBoundingClientRect().top < 0) {
      listRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="grid gap-4">
      <ul ref={listRef} id={listId} className="grid scroll-mt-28 grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c, index) => (
          <li key={c.id} className={!expanded && index >= INITIAL_CATEGORIES ? "hidden" : undefined}>
            <Link
              href={`/categories/${c.slug}`}
              className="group flex h-full items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 transition hover:bg-white hover:shadow-md focus-visible:outline-2 focus-visible:outline-[var(--brand)] sm:flex-col sm:items-stretch"
            >
              <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-white sm:aspect-[4/3] sm:size-auto">
                {c.coverKey ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(c.coverKey, 320)} alt="" loading="lazy" className="absolute inset-0 size-full object-contain p-1" />
                ) : (
                  <CategoryIcon icon={c.icon} className="absolute inset-0 m-auto size-7 text-[var(--brand)]" />
                )}
              </div>
              <span className="grid min-w-0">
                <span className="flex min-w-0 items-start gap-1.5 font-medium leading-snug text-slate-900">
                  <CategoryIcon icon={c.icon} className="mt-0.5 hidden size-4 shrink-0 text-[var(--brand)] sm:block" />
                  <span className="line-clamp-2 hyphens-auto">{c.name}</span>
                </span>
                <span className="text-xs text-slate-500">
                  {c.productCount} produit{c.productCount > 1 ? "s" : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          aria-controls={listId}
          className="inline-flex h-11 items-center justify-center gap-2 justify-self-center rounded-full bg-white px-5 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-slate-300 transition hover:bg-slate-50 hover:ring-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
        >
          {expanded ? "Voir moins" : `Voir plus de catégories (${hiddenCount})`}
          <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
        </button>
      )}
    </div>
  );
}
