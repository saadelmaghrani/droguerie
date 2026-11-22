// Bloc « utilisateur connecté » en bas du menu : initiales, nom, email, déconnexion.
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentAdmin } from "@/server/auth/dal";
import { LogoutButton } from "./logout-button";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export async function AdminUserMenu() {
  const admin = await getCurrentAdmin();
  if (!admin) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground"
        aria-hidden
      >
        {initials(admin.name) || "A"}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium text-sidebar-foreground">{admin.name}</p>
        <p className="truncate text-xs text-muted-foreground">{admin.email}</p>
      </div>
      <LogoutButton />
    </div>
  );
}

/** Affiché pendant que la session est vérifiée. */
export function AdminUserMenuSkeleton() {
  return (
    <div className="flex items-center gap-3 px-2 py-1.5" aria-hidden>
      <Skeleton className="size-8 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  );
}
