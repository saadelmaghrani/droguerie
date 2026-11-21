"use server";
// Actions serveur des produits. Points d'entrée publics : chacune commence par requireAdmin().

import { refresh } from "next/cache";
import { invalidateCatalogue } from "@/server/catalogue/cache";
import { z } from "zod";
import { isValidSlug, SLUG_MAX_LENGTH, slugify } from "@/lib/slug";
import { requireAdmin } from "@/server/auth/dal";
import {
  createProduct,
  deleteProduct,
  setProductFeatured,
  setProductStatus,
  updateProduct,
  type ProductField,
  type ServiceResult,
} from "./service";

const STATUSES = ["DRAFT", "PUBLISHED", "HIDDEN"] as const;
type Status = (typeof STATUSES)[number];

export type ProductFormValues = {
  name: string;
  slug: string;
  description: string;
  reference: string;
  brand: string;
  categoryId: string;
  status: Status;
  isFeatured: boolean;
};

export type ProductFormState =
  | { ok: true; message: string; id: string; created: boolean; submissionId: number }
  | { ok: false; message: string; fieldErrors: Partial<Record<ProductField, string>>; values: ProductFormValues; submissionId: number }
  | undefined;

const optional = (max: number, label: string) =>
  z.string().trim().max(max, `${label} : ${max} caractères maximum.`).transform((v) => v || null);

const formSchema = z.object({
  id: z.union([z.uuid(), z.literal("")]),
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(120, "Le nom : 120 caractères maximum."),
  slug: z.string().trim().max(SLUG_MAX_LENGTH, `L'adresse : ${SLUG_MAX_LENGTH} caractères maximum.`),
  description: optional(5000, "Description"),
  reference: optional(50, "Référence"),
  brand: optional(60, "Marque"),
  categoryId: z.uuid("Choisissez une catégorie."),
  status: z.enum(STATUSES, "Statut invalide."),
});

export async function saveProduct(_previous: ProductFormState, formData: FormData): Promise<ProductFormState> {
  await requireAdmin();
  const submissionId = Date.now();
  const text = (key: string, max = 6000) => String(formData.get(key) ?? "").slice(0, max);
  const values: ProductFormValues = {
    name: text("name", 500),
    slug: text("slug", 500),
    description: text("description"),
    reference: text("reference", 200),
    brand: text("brand", 200),
    categoryId: text("categoryId", 100),
    status: (STATUSES as readonly string[]).includes(text("status")) ? (text("status") as Status) : "DRAFT",
    isFeatured: formData.get("isFeatured") === "on",
  };

  const parsed = formSchema.safeParse({ id: formData.get("id") ?? "", ...values, status: text("status", 20) });
  const fieldErrors: Partial<Record<ProductField, string>> = {};
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === "id")) {
      return { ok: false, message: "Requête invalide.", fieldErrors, values, submissionId };
    }
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as ProductField] ??= issue.message;
  }
  // Adresse : vide → générée depuis le nom ; sinon elle doit être valide.
  const slug = parsed.success ? parsed.data.slug || slugify(parsed.data.name) : "";
  if (parsed.success && !isValidSlug(slug)) {
    fieldErrors.slug = "Adresse invalide : minuscules, chiffres et tirets uniquement.";
  }
  if (!parsed.success || Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Certains champs sont à corriger.", fieldErrors, values, submissionId };
  }

  const { id, name, description, reference, brand, categoryId, status } = parsed.data;
  const data = { name, slug, description, reference, brand, categoryId, status, isFeatured: values.isFeatured };
  const result = id ? await updateProduct(id, data) : await createProduct(data);

  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      fieldErrors: result.field ? { [result.field]: result.message } : {},
      values,
      submissionId,
    };
  }
  refresh();
  invalidateCatalogue();
  return { ok: true, message: result.message, id: result.id!, created: !id, submissionId };
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

export async function changeProductStatus(id: string, status: Status): Promise<ServiceResult> {
  return runRowAction(id, async (validId) => {
    const parsed = z.enum(STATUSES).safeParse(status);
    if (!parsed.success) return { ok: false, message: "Statut invalide." };
    return setProductStatus(validId, parsed.data);
  });
}

export async function toggleProductFeatured(id: string, isFeatured: boolean): Promise<ServiceResult> {
  return runRowAction(id, (validId) => setProductFeatured(validId, Boolean(isFeatured)));
}

export async function removeProduct(id: string): Promise<ServiceResult> {
  return runRowAction(id, deleteProduct);
}
