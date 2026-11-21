"use server";
// Actions serveur des catégories. Points d'entrée publics : chacune commence par requireAdmin().

import { refresh } from "next/cache";
import { invalidateCatalogue } from "@/server/catalogue/cache";
import { z } from "zod";
import { CATEGORY_ICON_KEYS } from "@/lib/category-icons";
import { isValidSlug, SLUG_MAX_LENGTH } from "@/lib/slug";
import { requireAdmin } from "@/server/auth/dal";
import {
  createCategory,
  deleteCategory,
  moveCategory,
  setCategoryActive,
  updateCategory,
  type CategoryField,
  type ServiceResult,
} from "./service";

export type CategoryFormValues = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  whatsappNumberId: string;
  isActive: boolean;
};

export type CategoryFormState =
  | { ok: true; message: string; submissionId: number }
  | { ok: false; message: string; fieldErrors: Partial<Record<CategoryField, string>>; values: CategoryFormValues }
  | undefined;

/** Valeur de la liste déroulante signifiant « utiliser le numéro par défaut ». */
const DEFAULT_WHATSAPP = "default";

const formSchema = z.object({
  id: z.union([z.uuid(), z.literal("")]),
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(60, "Le nom ne doit pas dépasser 60 caractères."),
  slug: z
    .string()
    .trim()
    .max(SLUG_MAX_LENGTH, `L'adresse ne doit pas dépasser ${SLUG_MAX_LENGTH} caractères.`)
    .refine(isValidSlug, "Adresse invalide : minuscules, chiffres et tirets uniquement (ex. produits-entretien)."),
  description: z.string().trim().max(500, "La description ne doit pas dépasser 500 caractères."),
  whatsappNumberId: z.union([z.uuid(), z.literal(DEFAULT_WHATSAPP)], { error: "Numéro WhatsApp invalide." }),
  // "" = pictogramme suggéré automatiquement d'après le nom.
  icon: z.union([z.enum(CATEGORY_ICON_KEYS), z.literal("")], { error: "Pictogramme invalide." }),
});

export async function saveCategory(_previous: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  await requireAdmin();

  const text = (key: string, max: number) => String(formData.get(key) ?? "").slice(0, max);
  const values: CategoryFormValues = {
    name: text("name", 200),
    slug: text("slug", 200),
    description: text("description", 2000),
    whatsappNumberId: text("whatsappNumberId", 100) || DEFAULT_WHATSAPP,
    icon: text("icon", 40),
    // Interrupteur : présent dans le formulaire uniquement s'il est activé.
    isActive: formData.get("isActive") === "on",
  };

  const parsed = formSchema.safeParse({ id: formData.get("id") ?? "", ...values });
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === "id")) {
      return { ok: false, message: "Requête invalide.", fieldErrors: {}, values };
    }
    const fieldErrors: Partial<Record<CategoryField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as CategoryField;
      fieldErrors[field] ??= issue.message;
    }
    return { ok: false, message: "Veuillez corriger les champs indiqués.", fieldErrors, values };
  }

  const { id, name, slug, description, whatsappNumberId, icon } = parsed.data;
  const data = {
    name,
    slug,
    description: description || null,
    icon: icon || null,
    whatsappNumberId: whatsappNumberId === DEFAULT_WHATSAPP ? null : whatsappNumberId,
    isActive: values.isActive,
  };
  const result = id ? await updateCategory(id, data) : await createCategory(data);

  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      fieldErrors: result.field ? { [result.field]: result.message } : {},
      values,
    };
  }
  refresh();
  invalidateCatalogue();
  return { ok: true, message: result.message, submissionId: Date.now() };
}

async function runRowAction(id: unknown, operation: (id: string) => Promise<ServiceResult>): Promise<ServiceResult> {
  await requireAdmin();
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };
  const result = await operation(parsed.data);
  if (result.ok) {
    refresh();
    invalidateCatalogue();
  }
  return result;
}

export async function toggleCategory(id: string, isActive: boolean): Promise<ServiceResult> {
  return runRowAction(id, (validId) => setCategoryActive(validId, Boolean(isActive)));
}

export async function moveCategoryUp(id: string): Promise<ServiceResult> {
  return runRowAction(id, (validId) => moveCategory(validId, "up"));
}

export async function moveCategoryDown(id: string): Promise<ServiceResult> {
  return runRowAction(id, (validId) => moveCategory(validId, "down"));
}

export async function removeCategory(id: string): Promise<ServiceResult> {
  return runRowAction(id, deleteCategory);
}
