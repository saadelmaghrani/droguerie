"use server";
// Actions serveur des numéros WhatsApp, appelées par l'interface d'administration.
// Ce sont des points d'entrée publics (requêtes HTTP) : chacune commence par requireAdmin().

import { refresh } from "next/cache";
import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { requireAdmin } from "@/server/auth/dal";
import {
  createWhatsappNumber,
  deleteWhatsappNumber,
  setDefaultWhatsappNumber,
  setWhatsappNumberActive,
  updateWhatsappNumber,
  type ServiceResult,
} from "./service";

export type FormState =
  | { ok: true; message: string; submissionId: number }
  | { ok: false; message: string; fieldErrors: { label?: string; phone?: string }; values: { label: string; phone: string } }
  | undefined;

const idSchema = z.uuid();

const formSchema = z.object({
  id: z.union([z.uuid(), z.literal("")]),
  label: z
    .string()
    .trim()
    .min(2, "Le libellé doit contenir au moins 2 caractères.")
    .max(60, "Le libellé ne doit pas dépasser 60 caractères."),
  phone: z.string().max(40, "Numéro trop long."),
});

/** Création (id vide) ou modification (id renseigné) depuis le formulaire. */
export async function saveWhatsappNumber(_previous: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();

  const values = {
    label: String(formData.get("label") ?? "").slice(0, 200),
    phone: String(formData.get("phone") ?? "").slice(0, 200),
  };
  const parsed = formSchema.safeParse({ id: formData.get("id") ?? "", ...values });
  const fieldErrors: { label?: string; phone?: string } = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "label" || field === "phone") fieldErrors[field] ??= issue.message;
    }
  }
  const phone = normalizePhone(values.phone);
  if (!phone.ok) fieldErrors.phone ??= phone.error;

  if (!parsed.success || !phone.ok) {
    if (parsed.success === false && parsed.error.issues.some((i) => i.path[0] === "id")) {
      return { ok: false, message: "Requête invalide.", fieldErrors, values };
    }
    return { ok: false, message: "Veuillez corriger les champs indiqués.", fieldErrors, values };
  }

  const data = { label: parsed.data.label, phone: phone.value };
  const result = parsed.data.id
    ? await updateWhatsappNumber(parsed.data.id, data)
    : await createWhatsappNumber(data);

  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      fieldErrors: result.field ? { [result.field]: result.message } : {},
      values,
    };
  }
  refresh();
  return { ok: true, message: result.message, submissionId: Date.now() };
}

async function runRowAction(id: unknown, operation: (id: string) => Promise<ServiceResult>): Promise<ServiceResult> {
  await requireAdmin();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, message: "Requête invalide." };
  const result = await operation(parsed.data);
  if (result.ok) refresh();
  return result;
}

export async function makeDefaultWhatsappNumber(id: string): Promise<ServiceResult> {
  return runRowAction(id, setDefaultWhatsappNumber);
}

export async function toggleWhatsappNumber(id: string, isActive: boolean): Promise<ServiceResult> {
  return runRowAction(id, (validId) => setWhatsappNumberActive(validId, Boolean(isActive)));
}

export async function removeWhatsappNumber(id: string): Promise<ServiceResult> {
  return runRowAction(id, deleteWhatsappNumber);
}
