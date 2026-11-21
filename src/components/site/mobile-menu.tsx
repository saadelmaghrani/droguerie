"use client";

// Menu mobile : catégories et liens principaux dans un panneau latéral.
import Link from "next/link";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type MenuCategory = { slug: string; name: string; productCount: number };

export function MobileMenu({ storeName, categories }: { storeName: string; categories: MenuCategory[] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Ouvrir le menu"
          className="inline-flex size-10 items-center justify-center rounded-full text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-[var(--brand)] md:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 max-w-[85vw] gap-0 bg-white p-0">
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="text-left">{storeName}</SheetTitle>
        </SheetHeader>
        <nav aria-label="Menu principal" className="overflow-y-auto px-3 py-3">
          <ul className="grid gap-0.5">
            <li><Link href="/" onClick={close} className="block rounded-lg px-3 py-2.5 font-medium text-slate-900 hover:bg-slate-100">Accueil</Link></li>
            <li><Link href="/produits" onClick={close} className="block rounded-lg px-3 py-2.5 font-medium text-slate-900 hover:bg-slate-100">Tous les produits</Link></li>
          </ul>
          {categories.length > 0 && (
            <>
              <p className="mt-4 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Catégories</p>
              <ul className="grid gap-0.5">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/categories/${c.slug}`} onClick={close} className="flex items-center justify-between rounded-lg px-3 py-2.5 text-slate-800 hover:bg-slate-100">
                      {c.name}
                      <span className="text-xs text-slate-500 tabular-nums">{c.productCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
