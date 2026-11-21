"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_NAV_ITEMS, isNavItemActive } from "./nav-items";

const linkClass =
  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Liens du menu admin. `onNavigate` sert au menu mobile (fermer le panneau après un clic). */
export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Administration" className="flex flex-col gap-1">
      {ADMIN_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isNavItemActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              linkClass,
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon
              className={cn(
                "size-4 shrink-0",
                active ? "text-sidebar-foreground" : "text-muted-foreground group-hover:text-sidebar-foreground",
              )}
              aria-hidden
            />
            {label}
          </Link>
        );
      })}

      <div className="my-2 h-px bg-sidebar-border" role="separator" />

      <a
        href="/"
        target="_blank"
        rel="noopener"
        onClick={onNavigate}
        className={cn(linkClass, "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground")}
      >
        <ExternalLink className="size-4 shrink-0" aria-hidden />
        Voir le site
        <span className="sr-only">(nouvel onglet)</span>
      </a>
    </nav>
  );
}
