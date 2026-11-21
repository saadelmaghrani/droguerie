import Link from "next/link";
import { Store } from "lucide-react";

/** Logo + nom affichés en haut du menu (le logo du client remplacera l'icône plus tard). */
export function AdminBrand() {
  return (
    <Link
      href="/admin"
      className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Store className="size-[18px]" aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-sm font-semibold text-sidebar-foreground">Droguerie</span>
        <span className="text-xs text-muted-foreground">Administration</span>
      </span>
    </Link>
  );
}
