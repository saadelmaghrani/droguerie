// Données de la fiche produit telle qu'elle apparaît sur le site (aperçu admin, puis site public).
// Sans authentification : la page d'aperçu appelle requireAdmin() AVANT.
import "server-only";

import { categoryIconKey, type CategoryIconKey } from "@/lib/category-icons";
import { prisma } from "@/lib/prisma";
import { pickWhatsappPhone } from "@/lib/product-visibility";
import type { ProductStatusValue } from "@/lib/product-status";

export type ProductDetailData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  reference: string | null;
  brand: string | null;
  status: ProductStatusValue;
  /** icon : pictogramme de la catégorie (image par défaut d'un produit sans photo). */
  category: { name: string; slug: string; isActive: boolean; icon: CategoryIconKey };
  images: { id: string; storageKey: string; width: number; height: number }[];
  /** Numéro WhatsApp résolu (catégorie, sinon défaut), ou null. */
  whatsappPhone: string | null;
};

export async function getProductDetail(id: string): Promise<ProductDetailData | null> {
  const [product, defaultNumber] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: { name: true, slug: true, isActive: true, icon: true, whatsappNumber: { select: { phone: true, isActive: true } } },
        },
        images: { orderBy: { position: "asc" }, select: { id: true, storageKey: true, width: true, height: true } },
      },
    }),
    prisma.whatsappNumber.findFirst({ where: { isDefault: true }, select: { phone: true, isActive: true } }),
  ]);
  if (!product) return null;

  const { whatsappNumber, icon, ...rest } = product.category;
  const category = { ...rest, icon: categoryIconKey(icon, rest.name) };
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    reference: product.reference,
    brand: product.brand,
    status: product.status,
    category,
    images: product.images,
    whatsappPhone: pickWhatsappPhone(whatsappNumber, defaultNumber),
  };
}
