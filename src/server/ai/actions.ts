"use server";
// Actions serveur de l'IA. Points d'entrée publics : requireAdmin() en premier.
// La clé OpenAI reste sur le serveur : le navigateur ne reçoit que les résultats ou un message d'erreur.
//
// L'IA n'est proposée QUE sur la page « Nouveau produit » (bouton « Générer avec l'IA »).

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/dal";
import { invalidateCatalogue } from "@/server/catalogue/cache";
import { readUploadedFile } from "@/server/media/images";
import { attachDraftToProduct, createProductDraft, discardDraft, EXTRA_SLOTS, MAX_EXTRAS, type DraftResult } from "./draft-service";
import { isAiFeatureEnabled } from "./client";
import { testAiConnection } from "./product-text";
import { cleanNotes } from "./product-text-prompt";

const uuid = z.uuid();
const draftOptionsSchema = z.object({
  extraCount: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  extraKind: z.enum(["montage", "ai"]),
});

/** Un seul clic : fond blanc + 2 montages locaux + nom/description (+ 2 mises en scène IA si demandées). Rien n'est enregistré sur un produit. */
export async function generateProductDraftAction(formData: FormData): Promise<DraftResult> {
  const admin = await requireAdmin();
  if (!isAiFeatureEnabled()) return { ok: false, message: "L'IA est en pause (AI_ENABLED n'est pas activé dans le .env)." };
  if (!(formData instanceof FormData)) return { ok: false, message: "Requête invalide." };
  const upload = readUploadedFile(formData.get("file"));
  if (!upload.ok) return { ok: false, message: upload.error };
  const name = String(formData.get("name") ?? "").slice(0, 120);
  const categoryId = String(formData.get("categoryId") ?? "");
  const category = uuid.safeParse(categoryId).success
    ? await prisma.category.findUnique({ where: { id: categoryId }, select: { name: true } })
    : null;
  const options = draftOptionsSchema.safeParse({
    extraCount: Number(formData.get("extraCount") ?? 2),
    extraKind: formData.get("extraKind") ?? "montage",
  });
  if (!options.success) return { ok: false, message: "Choix de photos invalide." };
  const notes = cleanNotes(String(formData.get("notes") ?? ""));
  return createProductDraft(
    upload.file,
    { name, description: "", brand: "", reference: "", categoryName: category?.name ?? "", notes },
    admin.id,
    options.data,
  );
}

const choiceSchema = z.object({
  main: z.enum(["studio", "original"]),
  keep: z.array(z.enum(EXTRA_SLOTS)).max(MAX_EXTRAS),
});

/** Après « Créer le produit » : rattache les photos choisies par l'admin. */
export async function attachProductDraftAction(productId: string, draftId: string, choice: z.infer<typeof choiceSchema>) {
  await requireAdmin();
  const parsed = choiceSchema.safeParse(choice);
  if (!uuid.safeParse(productId).success || !uuid.safeParse(draftId).success || !parsed.success) {
    return { ok: false as const, message: "Requête invalide." };
  }
  const result = await attachDraftToProduct(productId, draftId, parsed.data);
  if (result.ok) invalidateCatalogue();
  return result;
}

export async function discardProductDraftAction(draftId: string): Promise<void> {
  await requireAdmin();
  if (uuid.safeParse(draftId).success) await discardDraft(draftId);
}

export async function testAiConnectionAction() {
  await requireAdmin();
  return testAiConnection();
}
