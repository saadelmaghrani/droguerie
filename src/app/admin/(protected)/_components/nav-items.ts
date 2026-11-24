// Entrées du menu de l'administration (source unique : menu latéral + menu mobile).
import {
  ChartColumn,
  LayoutDashboard,
  MessageCircle,
  Package,
  Settings,
  Tags,
  UserCog,
  type LucideIcon,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/admin/produits", label: "Produits", icon: Package },
  { href: "/admin/categories", label: "Catégories", icon: Tags },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/admin/statistiques", label: "Statistiques", icon: ChartColumn },
  { href: "/admin/parametres", label: "Paramètres", icon: Settings },
  { href: "/admin/compte", label: "Mon compte", icon: UserCog },
];

/** Le tableau de bord n'est actif que sur /admin exactement ; les autres sur leurs sous-pages aussi. */
export function isNavItemActive(href: string, pathname: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
