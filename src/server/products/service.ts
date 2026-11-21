// Règles métier des produits (sans authentification : appelé par actions.ts,
// qui vérifie l'admin AVANT d'appeler ces fonctions).
import "server-only";

import { Prisma, type ProductStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { deleteImageFiles } from "@/server/media/images";
import { productImageKeys } from "./images-service";

export const PRODUCTS_PAGE_SIZE = 20;

export type ProductField = "name" | "slug" | "description" | "reference" | "brand" | "categoryId" | "status";
export type ServiceResult =
  | { ok: true; message: string; id?: string }
  | { ok: false; message: string; field?: ProductField };

export type ProductListRow = {
  id: string;
  name: string;
  slug: string;
  reference: string | null;
  brand: string | null;
  status: ProductStatus;
  isFeatured: boolean;
  category: { id: string; name: string; isActive: boolean };
  imageCount: number;
  /** Clé de la photo principale (vignette), ou null. */
  primaryImageKey: string | null;
  updatedAt: string;
};

export type ProductListQuery = {
  q: string;
  categoryId: string | null;
  status: ProductStatus | null;
  page: number;
};

export type ProductInput = {
  name: string;
  slug: string;
  description: string | null;
  reference: string | null;
  brand: string | null;
  categoryId: string;
  status: ProductStatus;
  isFeatured: boolean;
};

const NOT_FOUND: ServiceResult = { ok: false, message: "Ce produit n'existe plus (il a peut-être été supprimé)." };

function prismaCode(error: unknown): string | undefined {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
}

/**
 * Liste paginée avec recherche et filtres.
 * Recherche = plein texte français (index products_search_fts_idx)
 *          OU tolérance aux fautes sur le nom (index products_name_trgm_idx, opérateur <%)
 *          OU début de référence.
 * Les expressions SQL doivent rester identiques à celles des index (voir docs/database.md).
 */
export async function listProducts(query: ProductListQuery): Promise<{
  rows: ProductListRow[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const q = query.q.trim().slice(0, 100);
  const qNormalized = q.toLowerCase();
  const offset = (query.page - 1) * PRODUCTS_PAGE_SIZE;

  const document = Prisma.sql`public.product_search_document(p.name, p.brand, p.reference, p.description)`;
  const tsQuery = Prisma.sql`websearch_to_tsquery('pg_catalog.french'::regconfig, public.immutable_unaccent(${q}))`;
  const nameNormalized = Prisma.sql`public.immutable_unaccent(lower(p.name))`;

  const conditions: Prisma.Sql[] = [];
  if (query.categoryId) conditions.push(Prisma.sql`p.category_id = ${query.categoryId}::uuid`);
  if (query.status) conditions.push(Prisma.sql`p.status = ${query.status}::product_status`);
  if (q) {
    conditions.push(Prisma.sql`(
      ${document} @@ ${tsQuery}
      OR public.immutable_unaccent(${qNormalized}) <% ${nameNormalized}
      OR lower(p.reference) LIKE ${qNormalized.replace(/[\\%_]/g, "\\$&") + "%"}
    )`);
  }
  const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
  const orderBy = q
    ? Prisma.sql`ORDER BY ts_rank(${document}, ${tsQuery}) + word_similarity(public.immutable_unaccent(${qNormalized}), ${nameNormalized}) DESC, p.updated_at DESC`
    : Prisma.sql`ORDER BY p.updated_at DESC`;

  const matches = await prisma.$queryRaw<{ id: string; total: bigint }[]>`
    SELECT p.id, count(*) OVER () AS total
    FROM products p
    ${where}
    ${orderBy}
    LIMIT ${PRODUCTS_PAGE_SIZE} OFFSET ${offset}
  `;

  const total = matches.length ? Number(matches[0]!.total) : await countProducts(where);
  const pageCount = Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE));
  const ids = matches.map((m) => m.id);
  const products = ids.length
    ? await prisma.product.findMany({
        where: { id: { in: ids } },
        include: {
          category: { select: { id: true, name: true, isActive: true } },
          _count: { select: { images: true } },
          images: { where: { position: 0 }, select: { storageKey: true } },
        },
      })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));

  return {
    rows: ids.flatMap((id) => {
      const p = byId.get(id);
      if (!p) return [];
      return [{
        id: p.id,
        name: p.name,
        slug: p.slug,
        reference: p.reference,
        brand: p.brand,
        status: p.status,
        isFeatured: p.isFeatured,
        category: p.category,
        imageCount: p._count.images,
        primaryImageKey: p.images[0]?.storageKey ?? null,
        updatedAt: p.updatedAt.toISOString(),
      }];
    }),
    total,
    page: query.page,
    pageCount,
  };
}

/** Utilisé quand la page demandée est au-delà des résultats (OFFSET trop grand). */
async function countProducts(where: Prisma.Sql): Promise<number> {
  const [row] = await prisma.$queryRaw<{ total: bigint }[]>`SELECT count(*) AS total FROM products p ${where}`;
  return Number(row?.total ?? 0);
}

export async function listCategoryOptions() {
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, isActive: true },
  });
}

export async function getProduct(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: {
      _count: { select: { images: true } },
      images: { orderBy: { position: "asc" }, select: { id: true, position: true, storageKey: true, width: true, height: true } },
    },
  });
}

/** Adresse libre : base, puis base-2, base-3… (excludeId : le produit modifié). */
async function availableSlug(base: string, excludeId?: string): Promise<string> {
  const root = base.slice(0, 74).replace(/-+$/, "") || "produit";
  const taken = new Set(
    (
      await prisma.product.findMany({
        where: { slug: { startsWith: root }, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { slug: true },
      })
    ).map((p) => p.slug),
  );
  if (!taken.has(root)) return root;
  for (let n = 2; ; n++) if (!taken.has(`${root}-${n}`)) return `${root}-${n}`;
}

async function validate(data: ProductInput, excludeId?: string): Promise<ServiceResult | null> {
  const notSelf = excludeId ? { id: { not: excludeId } } : {};
  const [category, sameReference] = await Promise.all([
    prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true } }),
    data.reference
      ? prisma.product.findFirst({
          where: { reference: { equals: data.reference, mode: "insensitive" }, ...notSelf },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);
  if (!category) return { ok: false, message: "Cette catégorie n'existe plus. Choisissez-en une autre.", field: "categoryId" };
  if (sameReference) {
    return { ok: false, message: `Cette référence est déjà utilisée par « ${sameReference.name} ».`, field: "reference" };
  }
  return null;
}

function uniqueViolation(error: unknown): ServiceResult | null {
  if (prismaCode(error) !== "P2002") return null;
  return { ok: false, message: "Cette adresse ou cette référence vient d'être utilisée par un autre produit. Réessayez." };
}

export async function createProduct(data: ProductInput): Promise<ServiceResult> {
  const invalid = await validate(data);
  if (invalid) return invalid;
  try {
    // À la création, une adresse déjà prise reçoit automatiquement un suffixe (-2, -3…).
    const slug = await availableSlug(data.slug || slugify(data.name));
    const product = await prisma.product.create({
      data: { ...data, slug, publishedAt: data.status === "PUBLISHED" ? new Date() : null },
    });
    return { ok: true, message: `Produit « ${product.name} » créé.`, id: product.id };
  } catch (error) {
    const duplicate = uniqueViolation(error);
    if (duplicate) return duplicate;
    throw error;
  }
}

export async function updateProduct(id: string, data: ProductInput): Promise<ServiceResult> {
  const invalid = await validate(data, id);
  if (invalid) return invalid;
  const current = await prisma.product.findUnique({ where: { id }, select: { publishedAt: true } });
  if (!current) return NOT_FOUND;
  // À la modification, l'adresse est choisie explicitement : un doublon est une erreur.
  const slugOwner = await prisma.product.findFirst({ where: { slug: data.slug, id: { not: id } }, select: { name: true } });
  if (slugOwner) return { ok: false, message: `Cette adresse est déjà utilisée par « ${slugOwner.name} ».`, field: "slug" };
  try {
    await prisma.product.update({
      where: { id },
      data: {
        ...data,
        // Date de première publication : conservée ensuite (ordre des « Nouveautés »).
        publishedAt: current.publishedAt ?? (data.status === "PUBLISHED" ? new Date() : null),
      },
    });
    return { ok: true, message: `Produit « ${data.name} » enregistré.`, id };
  } catch (error) {
    if (prismaCode(error) === "P2025") return NOT_FOUND;
    const duplicate = uniqueViolation(error);
    if (duplicate) return duplicate;
    throw error;
  }
}

const STATUS_MESSAGES: Record<ProductStatus, string> = {
  PUBLISHED: "est maintenant visible sur le site",
  DRAFT: "est repassé en brouillon",
  HIDDEN: "est masqué du site",
};

export async function setProductStatus(id: string, status: ProductStatus): Promise<ServiceResult> {
  const current = await prisma.product.findUnique({ where: { id }, select: { name: true, publishedAt: true } });
  if (!current) return NOT_FOUND;
  await prisma.product.update({
    where: { id },
    data: { status, publishedAt: current.publishedAt ?? (status === "PUBLISHED" ? new Date() : null) },
  });
  return { ok: true, message: `« ${current.name} » ${STATUS_MESSAGES[status]}.` };
}

export async function setProductFeatured(id: string, isFeatured: boolean): Promise<ServiceResult> {
  try {
    const product = await prisma.product.update({ where: { id }, data: { isFeatured } });
    return {
      ok: true,
      message: isFeatured ? `« ${product.name} » est mis en avant.` : `« ${product.name} » n'est plus mis en avant.`,
    };
  } catch (error) {
    if (prismaCode(error) === "P2025") return NOT_FOUND;
    throw error;
  }
}

export async function deleteProduct(id: string): Promise<ServiceResult> {
  try {
    // Les lignes photos sont supprimées avec le produit (ON DELETE CASCADE) ; les statistiques
    // sont conservées sans lien (ON DELETE SET NULL). Les FICHIERS sont supprimés ensuite,
    // une fois la suppression en base confirmée.
    const keys = await productImageKeys(id);
    const product = await prisma.product.delete({ where: { id } });
    await Promise.all(keys.map((key) => deleteImageFiles(key, "product")));
    return { ok: true, message: `Produit « ${product.name} » supprimé.` };
  } catch (error) {
    if (prismaCode(error) === "P2025") return NOT_FOUND;
    throw error;
  }
}
