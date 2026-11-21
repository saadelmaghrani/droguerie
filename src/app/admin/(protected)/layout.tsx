// Mise en page des pages admin protégées.
// (protected) est un « groupe de routes » : il n'apparaît pas dans l'URL.
// ⚠️ Ce layout n'est PAS une protection : chaque page appelle requireAdmin().
//
//  Ordinateur (≥ 1024 px)              Mobile
//  ┌──────────┬───────────────┐        ┌──────────────────┐
//  │ Logo     │               │        │ ☰  Logo          │
//  │ Menu     │   Contenu     │        ├──────────────────┤
//  │          │               │        │     Contenu      │
//  │ Admin ⎋  │               │        │                  │
//  └──────────┴───────────────┘        └──────────────────┘
import { Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AdminBrand } from "./_components/admin-brand";
import { AdminNav, AdminNavLinks } from "./_components/admin-nav";
import { AdminUserMenu, AdminUserMenuSkeleton } from "./_components/admin-user-menu";
import { MobileNav } from "./_components/mobile-nav";

function UserMenu() {
  // Lit la session → frontière Suspense obligatoire (Cache Components).
  return (
    <Suspense fallback={<AdminUserMenuSkeleton />}>
      <AdminUserMenu />
    </Suspense>
  );
}

export default function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/40 lg:grid lg:grid-cols-[16rem_1fr]">
      {/* Menu latéral : ordinateur uniquement */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="border-b border-sidebar-border px-4 py-4">
          <AdminBrand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {/* usePathname() lit l'URL : frontière Suspense obligatoire (pages à adresse variable). */}
          <Suspense fallback={<AdminNavLinks pathname="" />}>
            <AdminNav />
          </Suspense>
        </div>
        <div className="border-t border-sidebar-border p-3">
          <UserMenu />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Barre supérieure : mobile et tablette uniquement */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-2 backdrop-blur supports-backdrop-filter:bg-background/70 lg:hidden">
          <MobileNav brand={<AdminBrand />} footer={<UserMenu />} />
          <AdminBrand />
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Notifications (« Numéro ajouté », erreurs…) */}
      <Toaster position="top-center" />
    </div>
  );
}
