"use client";

import { Suspense, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AdminNav, AdminNavLinks } from "./admin-nav";

/**
 * Menu mobile : bouton ☰ qui ouvre le menu dans un panneau latéral.
 * `brand` et `footer` sont des composants serveur passés en props
 * (un composant client ne peut pas les importer directement).
 */
export function MobileNav({ brand, footer }: { brand: React.ReactNode; footer: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" aria-label="Ouvrir le menu">
          <Menu className="size-5" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col gap-0 bg-sidebar p-0">
        <SheetHeader className="border-b border-sidebar-border px-4 py-4">
          <SheetTitle className="sr-only">Menu d&apos;administration</SheetTitle>
          <SheetDescription className="sr-only">Navigation entre les sections de l&apos;administration.</SheetDescription>
          {brand}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <Suspense fallback={<AdminNavLinks pathname="" />}>
            <AdminNav onNavigate={() => setOpen(false)} />
          </Suspense>
        </div>
        <div className="border-t border-sidebar-border p-3">{footer}</div>
      </SheetContent>
    </Sheet>
  );
}
