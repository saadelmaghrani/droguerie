// Mise en page des pages admin protégées.
// (protected) est un « groupe de routes » : il n'apparaît pas dans l'URL.
// ⚠️ Ce layout n'est PAS une protection : chaque page appelle requireAdmin().
import Link from "next/link";
import { Suspense } from "react";
import { AdminUserMenu } from "./admin-user-menu";

export default function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="font-semibold">
            Administration
          </Link>
          <Suspense fallback={<span className="h-8 w-40" aria-hidden />}>
            <AdminUserMenu />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
