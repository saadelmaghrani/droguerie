// Lectures du SITE PUBLIC, mises en cache ("use cache") et invalidées par invalidateCatalogue().
//
// Règle de visibilité (validée le 21/11/2026), appliquée dans CHAQUE requête :
//   produit visible ⇔ statut « Publié » ET catégorie visible (is_active).
// Aucune donnée d'administration (brouillons, références internes…) ne sort d'ici.
import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/color";
import { prisma } from "@/lib/prisma";
import type { SocialLinks } from "@/server/settings/service";
import { CATALOGUE_TAG } from "./cache";

export const CATALOGUE_PAGE_SIZE = 24;

function cached() {
  cacheTag(CATALOGUE_TAG);
  cacheLife("max"); // pas d'expiration par le temps : invalidé à chaque modification dans l'admin
}

/* ───────────────────────────── Paramètres du magasin ───────────────────────────── */

export type PublicSettings = {
  storeName: string;
  primaryColor: string;
  logoKey: string | null;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroCtaLabel: string | null;
  heroImageKey: string | null;
  aboutText: string | null;
  address: string | null;
  openingHours: string | null;
  phone: string | null;
  email: string | null;
  mapsEmbedUrl: string | null;
  socialLinks: SocialLinks;
  seoTitle: string | null;
  seoDescription: string | null;
  showFeatured: boolean;
  showNewArrivals: boolean;
  /** Numéro WhatsApp par défaut (contact général), ou null. */
  defaultWhatsapp: string | null;
};

export async function getPublicSettings(): Promise<PublicSettings> {
  "use cache";
  cached();
  const [row, whatsapp] = await Promise.all([
    prisma.storeSettings.findUnique({ where: { id: 1 } }),
    prisma.whatsappNumber.findFirst({ where: { isDefault: true, isActive: true }, select: { phone: true } }),
  ]);
  const social = (row?.socialLinks ?? {}) as SocialLinks;
  return {
    storeName: row?.storeName ?? "Droguerie",
    primaryColor: row?.primaryColor ?? DEFAULT_PRIMARY_COLOR,
    logoKey: row?.logoKey ?? null,
    heroTitle: row?.heroTitle ?? null,
    heroSubtitle: row?.heroSubtitle ?? null,
    heroCtaLabel: row?.heroCtaLabel ?? null,
    heroImageKey: row?.heroImageKey ?? null,
    aboutText: row?.aboutText ?? null,
    address: row?.address ?? null,
    openingHours: row?.openingHours ?? null,
    phone: row?.phone ?? null,
    email: row?.email ?? null,
    mapsEmbedUrl: row?.mapsEmbedUrl ?? null,
    socialLinks: { facebook: social.facebook, instagram: social.instagram, tiktok: social.tiktok },
    seoTitle: row?.seoTitle ?? null,
    seoDescription: row?.seoDescription ?? null,
    showFeatured: row?.showFeatured ?? true,
    showNewArrivals: row?.showNewArrivals ?? true,
    defaultWhatsapp: whatsapp?.phone ?? null,
  };
}

/* ───────────────────────────── Catégories ───────────────────────────── */

export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  productCount: number;
  /** Photo principale d'un produit de la catégorie (vignette), ou null. */
  coverKey: string | null;
};

/** Catégories visibles contenant au moins un produit visible, dans l'ordre choisi par l'admin. */
export async function getPublicCategories(): Promise<PublicCategory[]> {
  "use cache";
  cached();
  const rows = await prisma.$queryRaw<{ id: string; name: string; slug: string; description: string | null; product_count: bigint; cover_key: string | null }[]>`
    SELECT c.id, c.name, c.slug, c.description,
      count(p.id) AS product_count,
      (SELECT i.storage_key FROM products p2
         JOIN product_images i ON i.product_id = p2.id AND i.position = 0
        WHERE p2.category_id = c.id AND p2.status = 'PUBLISHED'
        ORDER BY p2.is_featured DESC, p2.published_at DESC NULLS LAST
        LIMIT 1) AS cover_key
    FROM categories c
    JOIN products p ON p.category_id = c.id AND p.status = 'PUBLISHED'
    WHERE c.is_active
    GROUP BY c.id
    ORDER BY c.sort_order, c.name
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    productCount: Number(r.product_count),
    coverKey: r.cover_key,
  }));
}

/* ───────────────────────────── Produits (cartes) ───────────────────────────── */

export type ProductCardData = {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  categoryName: string;
  image: { key: string; width: number; height: number } | null;
};

const visibleWhere = { status: "PUBLISHED" as const, category: { isActive: true } };
const cardSelect = {
  id: true,
  name: true,
  slug: true,
  brand: true,
  category: { select: { name: true } },
  images: { where: { position: 0 }, select: { storageKey: true, width: true, height: true } },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;
function toCard(p: CardRow): ProductCardData {
  const image = p.images[0];
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    categoryName: p.category.name,
    image: image ? { key: image.storageKey, width: image.width, height: image.height } : null,
  };
}

export async function getFeaturedProducts(limit = 8): Promise<ProductCardData[]> {
  "use cache";
  cached();
  const rows = await prisma.product.findMany({
    where: { ...visibleWhere, isFeatured: true },
    orderBy: [{ featuredOrder: { sort: "asc", nulls: "last" } }, { publishedAt: "desc" }],
    take: limit,
    select: cardSelect,
  });
  return rows.map(toCard);
}

export async function getNewArrivals(limit = 8): Promise<ProductCardData[]> {
  "use cache";
  cached();
  const rows = await prisma.product.findMany({
    where: visibleWhere,
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: limit,
    select: cardSelect,
  });
  return rows.map(toCard);
}

/* ───────────────────────────── Recherche / catalogue ───────────────────────────── */

export type CatalogueQuery = { q: string; categoryId: string | null; page: number };
export type CatalogueResult = { rows: ProductCardData[]; total: number; page: number; pageCount: number };

/**
 * Catalogue filtré : même recherche que l'admin (plein texte français sans accents, fautes de frappe
 * sur le nom, début de référence), limitée aux produits visibles. Expressions identiques aux index
 * (voir docs/database.md). Tri : pertinence si recherche, sinon nouveautés.
 */
export async function searchCatalogue(query: CatalogueQuery): Promise<CatalogueResult> {
  "use cache";
  cached();
  const q = query.q.trim().slice(0, 100);
  const qNormalized = q.toLowerCase();
  const offset = (query.page - 1) * CATALOGUE_PAGE_SIZE;

  const document = Prisma.sql`public.product_search_document(p.name, p.brand, p.reference, p.description)`;
  const tsQuery = Prisma.sql`websearch_to_tsquery('pg_catalog.french'::regconfig, public.immutable_unaccent(${q}))`;
  const nameNormalized = Prisma.sql`public.immutable_unaccent(lower(p.name))`;

  const conditions: Prisma.Sql[] = [Prisma.sql`p.status = 'PUBLISHED'`, Prisma.sql`c.is_active`];
  if (query.categoryId) conditions.push(Prisma.sql`p.category_id = ${query.categoryId}::uuid`);
  if (q) {
    conditions.push(Prisma.sql`(
      ${document} @@ ${tsQuery}
      OR public.immutable_unaccent(${qNormalized}) <% ${nameNormalized}
      OR lower(p.reference) LIKE ${qNormalized.replace(/[\\%_]/g, "\\$&") + "%"}
    )`);
  }
  const where = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
  const orderBy = q
    ? Prisma.sql`ORDER BY ts_rank(${document}, ${tsQuery}) + word_similarity(public.immutable_unaccent(${qNormalized}), ${nameNormalized}) DESC, p.published_at DESC NULLS LAST`
    : Prisma.sql`ORDER BY p.is_featured DESC, p.published_at DESC NULLS LAST, p.name`;

  const matches = await prisma.$queryRaw<{ id: string; total: bigint }[]>`
    SELECT p.id, count(*) OVER () AS total
    FROM products p JOIN categories c ON c.id = p.category_id
    ${where}
    ${orderBy}
    LIMIT ${CATALOGUE_PAGE_SIZE} OFFSET ${offset}
  `;
  const total = matches.length
    ? Number(matches[0]!.total)
    : Number((await prisma.$queryRaw<{ total: bigint }[]>`SELECT count(*) AS total FROM products p JOIN categories c ON c.id = p.category_id ${where}`)[0]?.total ?? 0);
  const ids = matches.map((m) => m.id);
  const products = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } }, select: cardSelect }) : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  return {
    rows: ids.flatMap((id) => (byId.has(id) ? [toCard(byId.get(id)!)] : [])),
    total,
    page: query.page,
    pageCount: Math.max(1, Math.ceil(total / CATALOGUE_PAGE_SIZE)),
  };
}
