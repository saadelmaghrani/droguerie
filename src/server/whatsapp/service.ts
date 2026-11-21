// Règles métier des numéros WhatsApp (sans authentification : appelé par actions.ts,
// qui vérifie l'admin AVANT d'appeler ces fonctions).
import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type ServiceResult = { ok: true; message: string } | { ok: false; message: string; field?: "label" | "phone" };

export type WhatsappNumberRow = {
  id: string;
  label: string;
  phone: string;
  isDefault: boolean;
  isActive: boolean;
  categories: string[];
};

const NOT_FOUND: ServiceResult = { ok: false, message: "Ce numéro n'existe plus (il a peut-être été supprimé)." };
const DUPLICATE: ServiceResult = { ok: false, message: "Ce numéro est déjà enregistré.", field: "phone" };

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
function isNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export async function listWhatsappNumbers(): Promise<WhatsappNumberRow[]> {
  const rows = await prisma.whatsappNumber.findMany({
    orderBy: [{ isDefault: "desc" }, { isActive: "desc" }, { label: "asc" }],
    include: { categories: { select: { name: true }, orderBy: { sortOrder: "asc" } } },
  });
  return rows.map(({ id, label, phone, isDefault, isActive, categories }) => ({
    id,
    label,
    phone,
    isDefault,
    isActive,
    categories: categories.map((c) => c.name),
  }));
}

export async function createWhatsappNumber(data: { label: string; phone: string }): Promise<ServiceResult> {
  try {
    const created = await prisma.$transaction(async (tx) => {
      // Premier numéro (ou aucun défaut existant) → il devient le numéro par défaut.
      const hasDefault = (await tx.whatsappNumber.count({ where: { isDefault: true } })) > 0;
      return tx.whatsappNumber.create({ data: { ...data, isDefault: !hasDefault, isActive: true } });
    });
    return {
      ok: true,
      message: created.isDefault ? "Numéro ajouté et défini comme numéro par défaut." : "Numéro ajouté.",
    };
  } catch (error) {
    if (isUniqueViolation(error)) return DUPLICATE;
    throw error;
  }
}

export async function updateWhatsappNumber(
  id: string,
  data: { label: string; phone: string },
): Promise<ServiceResult> {
  try {
    await prisma.whatsappNumber.update({ where: { id }, data });
    return { ok: true, message: "Numéro modifié." };
  } catch (error) {
    if (isUniqueViolation(error)) return DUPLICATE;
    if (isNotFound(error)) return NOT_FOUND;
    throw error;
  }
}

export async function setDefaultWhatsappNumber(id: string): Promise<ServiceResult> {
  return prisma.$transaction(async (tx) => {
    const target = await tx.whatsappNumber.findUnique({ where: { id } });
    if (!target) return NOT_FOUND;
    if (target.isDefault) return { ok: true, message: "Ce numéro est déjà le numéro par défaut." };

    // Ordre important : retirer l'ancien défaut AVANT de poser le nouveau
    // (l'index unique partiel interdit deux défauts simultanés).
    await tx.whatsappNumber.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
    await tx.whatsappNumber.update({ where: { id }, data: { isDefault: true, isActive: true } });
    return {
      ok: true,
      message: target.isActive
        ? `« ${target.label} » est maintenant le numéro par défaut.`
        : `« ${target.label} » est maintenant le numéro par défaut (et a été réactivé).`,
    };
  });
}

export async function setWhatsappNumberActive(id: string, isActive: boolean): Promise<ServiceResult> {
  const target = await prisma.whatsappNumber.findUnique({ where: { id } });
  if (!target) return NOT_FOUND;
  if (!isActive && target.isDefault) {
    return {
      ok: false,
      message: "Le numéro par défaut ne peut pas être désactivé. Choisissez d'abord un autre numéro par défaut.",
    };
  }
  await prisma.whatsappNumber.update({ where: { id }, data: { isActive } });
  return { ok: true, message: isActive ? "Numéro activé." : "Numéro désactivé." };
}

export async function deleteWhatsappNumber(id: string): Promise<ServiceResult> {
  const target = await prisma.whatsappNumber.findUnique({
    where: { id },
    include: { _count: { select: { categories: true } } },
  });
  if (!target) return NOT_FOUND;
  if (target.isDefault) {
    return {
      ok: false,
      message: "Le numéro par défaut ne peut pas être supprimé. Choisissez d'abord un autre numéro par défaut.",
    };
  }
  // Les catégories liées passent automatiquement sur le numéro par défaut (ON DELETE SET NULL).
  await prisma.whatsappNumber.delete({ where: { id } });
  const linked = target._count.categories;
  return {
    ok: true,
    message:
      linked > 0
        ? `Numéro supprimé. ${linked} catégorie${linked > 1 ? "s utilisent" : " utilise"} désormais le numéro par défaut.`
        : "Numéro supprimé.",
  };
}
