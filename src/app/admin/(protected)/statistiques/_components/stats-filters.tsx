"use client";

// Barre « Filtres » repliable : période (liens) et catégorie (liste, envoi automatique).
// Les filtres sont dans l'URL (?periode=…&categorie=…) : lien partageable, bouton retour fonctionnel.
import Form from "next/form";
import Link from "next/link";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { key: string; label: string };

export function StatsFilters({
  periods,
  period,
  categories,
  categoryId,
  rangeLabel,
}: {
  periods: Option[];
  period: string;
  categories: { id: string; name: string }[];
  categoryId: string;
  rangeLabel: string;
}) {
  const href = (p: string) => `/admin/statistiques?periode=${p}${categoryId ? `&categorie=${categoryId}` : ""}`;
  const summary = [periods.find((p) => p.key === period)?.label, categories.find((c) => c.id === categoryId)?.name ?? "Toutes les catégories"].join(" · ");
  return (
    <details open className="group rounded-xl border bg-card shadow-xs">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden />
        <span className="font-medium">Filtres</span>
        <span className="truncate text-sm text-muted-foreground">· {summary}</span>
        <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
        <nav aria-label="Période" className="flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-1">
          {periods.map((p) => (
            <Link
              key={p.key}
              href={href(p.key)}
              aria-current={p.key === period ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                p.key === period ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <Form action="/admin/statistiques" className="flex items-center gap-2">
          <input type="hidden" name="periode" value={period} />
          <label htmlFor="stats-category" className="text-sm text-muted-foreground">Catégorie</label>
          <select
            id="stats-category"
            name="categorie"
            defaultValue={categoryId}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <noscript><button type="submit" className="text-sm underline">Appliquer</button></noscript>
        </Form>
        <p className="text-sm text-muted-foreground sm:ml-auto">{rangeLabel}</p>
      </div>
    </details>
  );
}
