"use client";

// Recherche et filtres de la liste. <Form action=""> (next/form) : formulaire GET dont les
// valeurs vont dans l'URL (?q=…&categorie=…&statut=…) → lien partageable, bouton retour
// fonctionnel, et fonctionne même sans JavaScript.
import Form from "next/form";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PRODUCT_STATUSES, STATUS_INFO } from "@/lib/product-status";

const selectClass =
  "h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ProductFilters({
  q,
  categoryId,
  statusUrl,
  photo,
  categories,
}: {
  q: string;
  categoryId: string;
  statusUrl: string;
  photo: string;
  categories: { id: string; name: string; isActive: boolean }[];
}) {
  const active = Boolean(q || categoryId || statusUrl || photo);
  // Changer une liste déroulante relance la recherche immédiatement.
  const submitOnChange = (e: React.ChangeEvent<HTMLSelectElement>) => e.currentTarget.form?.requestSubmit();

  return (
    <Form action="" replace className="flex flex-col gap-2 rounded-xl border bg-background p-3 sm:flex-row sm:flex-wrap sm:items-center" role="search">
      <div className="relative min-w-0 flex-1 sm:min-w-64">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Nom, référence, marque…"
          aria-label="Rechercher un produit"
          className="pl-8"
          maxLength={100}
        />
      </div>
      <select name="categorie" defaultValue={categoryId} onChange={submitOnChange} aria-label="Filtrer par catégorie" className={selectClass}>
        <option value="">Toutes les catégories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.isActive ? "" : " (masquée)"}
          </option>
        ))}
      </select>
      <select name="statut" defaultValue={statusUrl} onChange={submitOnChange} aria-label="Filtrer par statut" className={selectClass}>
        <option value="">Tous les statuts</option>
        {PRODUCT_STATUSES.map((s) => (
          <option key={s} value={STATUS_INFO[s].url}>
            {STATUS_INFO[s].label}
          </option>
        ))}
      </select>
      <select name="photo" defaultValue={photo} onChange={submitOnChange} aria-label="Filtrer par photo" className={selectClass}>
        <option value="">Avec ou sans photo</option>
        <option value="sans">Sans photo</option>
      </select>
      <div className="flex gap-2">
        <Button type="submit" variant="secondary">
          Rechercher
        </Button>
        {active && (
          <Button variant="ghost" asChild>
            <Link href="/admin/produits" replace>
              <X className="size-4" aria-hidden />
              Effacer
            </Link>
          </Button>
        )}
      </div>
    </Form>
  );
}
