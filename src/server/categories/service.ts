// Règles métier des catégories (sans authentification : appelé par actions.ts,
// qui vérifie l'admin AVANT d'appeler ces fonctions).
import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type CategoryField = "name" | "slug" | "description" | "whatsappNumberId";
export type ServiceResult = { ok: true; message: string } | { ok: false; message: string; field?: CategoryField };

export type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  whatsappNumberId: string | null;
  whatsapp: { label: string; phone: string; isActive: boolean } | null;
  productCount: number;
  publishedCount: number;
};

export type WhatsappOption = { id: string; label: string; phone: string; isActive: boolean; isDefault: boolean };

export type CategoryInput = {
  name: string;
  slug: string;
  description: string | null;
  whatsappNumberId: string | null;
  isActive: boolean;
};

const NOT_FOUND: ServiceResult = { ok: false, message: "Cette catégorie n'existe plus (elle a peut-être été supprimée)." };

function prismaCode(error: unknown): string | undefined {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
}

export async function listCategories(): Promise<CategoryRow[]> {
  const [rows, published] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        whatsappNumber: { select: { label: true, phone: true, isActive: true } },
        _count: { select: { products: true } },
      },
    }),
    prisma.product.groupBy({ by: ["categoryId"], where: { status: "PUBLISHED" }, _count: { _all: true } }),
  ]);
  const publishedByCategory = new Map(published.map((p) => [p.categoryId, p._count._all]));

  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    isActive: c.isActive,
    whatsappNumberId: c.whatsappNumberId,
    whatsapp: c.whatsappNumber,
    productCount: c._count.products,
    publishedCount: publishedByCategory.get(c.id) ?? 0,
  }));
}

export async function listWhatsappOptions(): Promise<WhatsappOption[]> {
  return prisma.whatsappNumber.findMany({
    orderBy: [{ isDefault: "desc" }, { isActive: "desc" }, { label: "asc" }],
    select: { id: true, label: true, phone: true, isActive: true, isDefault: true },
  });
}

/** Vérifie unicité du nom / du slug et existence du numéro (excludeId : la catégorie modifiée). */
async function validate(data: CategoryInput, excludeId?: string): Promise<ServiceResult | null> {
  const notSelf = excludeId ? { id: { not: excludeId } } : {};
  const [sameName, sameSlug, whatsapp] = await Promise.all([
    prisma.category.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, ...notSelf }, select: { id: true } }),
    prisma.category.findFirst({ where: { slug: data.slug, ...notSelf }, select: { id: true } }),
    data.whatsappNumberId
      ? prisma.whatsappNumber.findUnique({ where: { id: data.whatsappNumberId }, select: { id: true } })
      : Promise.resolve({ id: null }),
  ]);
  if (sameName) return { ok: false, message: "Une catégorie porte déjà ce nom.", field: "name" };
  if (sameSlug) return { ok: false, message: "Cette adresse est déjà utilisée par une autre catégorie.", field: "slug" };
  if (!whatsapp) return { ok: false, message: "Ce numéro WhatsApp n'existe plus. Choisissez-en un autre.", field: "whatsappNumberId" };
  return null;
}

export async function createCategory(data: CategoryInput): Promise<ServiceResult> {
  const invalid = await validate(data);
  if (invalid) return invalid;
  try {
    await prisma.$transaction(async (tx) => {
      // Nouvelle catégorie : placée en fin de liste.
      const last = await tx.category.aggregate({ _max: { sortOrder: true } });
      await tx.category.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
    });
    return { ok: true, message: `Catégorie « ${data.name} » créée.` };
  } catch (error) {
    // Course rare : un doublon créé entre la vérification et l'insertion.
    if (prismaCode(error) === "P2002") return { ok: false, message: "Ce nom ou cette adresse est déjà utilisé." };
    throw error;
  }
}

export async function updateCategory(id: string, data: CategoryInput): Promise<ServiceResult> {
  const invalid = await validate(data, id);
  if (invalid) return invalid;
  try {
    await prisma.category.update({ where: { id }, data });
    return { ok: true, message: `Catégorie « ${data.name} » modifiée.` };
  } catch (error) {
    if (prismaCode(error) === "P2025") return NOT_FOUND;
    if (prismaCode(error) === "P2002") return { ok: false, message: "Ce nom ou cette adresse est déjà utilisé." };
    throw error;
  }
}

export async function setCategoryActive(id: string, isActive: boolean): Promise<ServiceResult> {
  try {
    const category = await prisma.category.update({ where: { id }, data: { isActive } });
    return {
      ok: true,
      message: isActive
        ? `« ${category.name} » est de nouveau visible sur le site.`
        : `« ${category.name} » et ses produits sont masqués du site.`,
    };
  } catch (error) {
    if (prismaCode(error) === "P2025") return NOT_FOUND;
    throw error;
  }
}

/** Monte ou descend une catégorie d'un cran dans l'ordre d'affichage. */
export async function moveCategory(id: string, direction: "up" | "down"): Promise<ServiceResult> {
  return prisma.$transaction(async (tx) => {
    const ordered = await tx.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, sortOrder: true },
    });
    const index = ordered.findIndex((c) => c.id === id);
    if (index === -1) return NOT_FOUND;
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= ordered.length) return { ok: true, message: "Déjà en bout de liste." };

    // Échange, puis renumérotation 0, 1, 2… (corrige d'éventuels doublons d'ordre).
    [ordered[index], ordered[target]] = [ordered[target]!, ordered[index]!];
    await Promise.all(
      ordered.map((c, position) =>
        c.sortOrder === position ? null : tx.category.update({ where: { id: c.id }, data: { sortOrder: position } }),
      ),
    );
    return { ok: true, message: "Ordre mis à jour." };
  });
}

export async function deleteCategory(id: string): Promise<ServiceResult> {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!category) return NOT_FOUND;
  const count = category._count.products;
  if (count > 0) {
    return {
      ok: false,
      message: `« ${category.name} » contient ${count} produit${count > 1 ? "s" : ""}. Déplacez-les vers une autre catégorie ou supprimez-les d'abord.`,
    };
  }
  try {
    await prisma.category.delete({ where: { id } });
  } catch (error) {
    // Un produit ajouté entre la vérification et la suppression : la base refuse (RESTRICT).
    if (prismaCode(error) === "P2003") {
      return { ok: false, message: `« ${category.name} » contient des produits : suppression impossible.` };
    }
    if (prismaCode(error) === "P2025") return NOT_FOUND;
    throw error;
  }
  return { ok: true, message: `Catégorie « ${category.name} » supprimée.` };
}
