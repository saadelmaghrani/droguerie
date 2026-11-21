// Image par défaut d'un produit sans photo (produits publiés avant la règle « photo obligatoire ») :
// pictogramme de sa catégorie sur un fond teinté de la couleur du site. Jamais une fausse photo.
import { CategoryIcon, type CategoryIconKey } from "@/lib/category-icons";
import { cn } from "@/lib/utils";

export function ProductPlaceholder({ icon, size = "md", className }: { icon: CategoryIconKey; size?: "md" | "lg"; className?: string }) {
  return (
    <div
      role="img"
      aria-label="Photo à venir"
      className={cn("flex size-full flex-col items-center justify-center gap-2 bg-[color-mix(in_oklab,var(--brand,#334155)_7%,white)]", className)}
    >
      <CategoryIcon icon={icon} className={cn("text-[var(--brand,#334155)] opacity-80", size === "lg" ? "size-20" : "size-10")} />
      {size === "lg" && <span className="text-sm text-slate-500">Photo à venir</span>}
    </div>
  );
}
