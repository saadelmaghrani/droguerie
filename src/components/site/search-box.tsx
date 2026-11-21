// Recherche rapide (nom, marque, description, référence). Formulaire GET : fonctionne sans JavaScript,
// et <Form> de Next.js navigue sans recharger la page quand JavaScript est actif.
import Form from "next/form";
import { Search } from "lucide-react";

export function SearchBox({
  action = "/produits",
  defaultValue = "",
  placeholder = "Rechercher un produit…",
  autoFocus = false,
  size = "md",
}: {
  action?: string;
  defaultValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  size?: "md" | "lg";
}) {
  return (
    <Form action={action} role="search" className="relative w-full">
      <label htmlFor={`search-${size}`} className="sr-only">Rechercher un produit</label>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        id={`search-${size}`}
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        autoFocus={autoFocus}
        maxLength={100}
        enterKeyHint="search"
        autoComplete="off"
        className={`w-full rounded-full border border-slate-300 bg-white pr-4 pl-10 text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-[var(--brand)] focus:ring-3 focus:ring-[var(--brand)]/20 ${size === "lg" ? "h-12 text-base" : "h-10 text-sm"}`}
      />
    </Form>
  );
}
