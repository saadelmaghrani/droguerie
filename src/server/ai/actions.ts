"use server";
// Actions serveur de l'IA. Points d'entrée publics : requireAdmin() en premier.
// La clé OpenAI reste sur le serveur : le navigateur ne reçoit que la suggestion ou un message d'erreur.

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/server/auth/dal";
import { decideProductText, suggestProductText, testAiConnection, type SuggestResult } from "./product-text";

const hintsSchema = z.object({
  name: z.string().max(500),
  description: z.string().max(6000),
  brand: z.string().max(200),
  reference: z.string().max(200),
  categoryId: z.union([z.uuid(), z.literal("")]),
});

export type ProductTextHintsInput = z.infer<typeof hintsSchema>;

/** Propose nom + description. Les valeurs ACTUELLES du formulaire servent d'indices (même non enregistrées). */
export async function suggestProductTextAction(productId: string, hints: ProductTextHintsInput): Promise<SuggestResult> {
  const admin = await requireAdmin();
  const id = z.uuid().safeParse(productId);
  const parsed = hintsSchema.safeParse(hints);
  if (!id.success || !parsed.success) return { ok: false, kind: "bad_response", message: "Requête invalide.", accountAction: false };

  const [product, category] = await Promise.all([
    prisma.product.findUnique({ where: { id: id.data }, select: { id: true } }),
    parsed.data.categoryId
      ? prisma.category.findUnique({ where: { id: parsed.data.categoryId }, select: { name: true } })
      : Promise.resolve(null),
  ]);
  if (!product) return { ok: false, kind: "bad_response", message: "Ce produit n'existe plus.", accountAction: false };

  const { name, description, brand, reference } = parsed.data;
  return suggestProductText(product.id, { name, description, brand, reference, categoryName: category?.name ?? "" }, admin.id);
}

/** L'admin a utilisé (accepted = true) ou refusé la suggestion. */
export async function decideProductTextAction(generationId: string, accepted: boolean): Promise<{ ok: boolean }> {
  await requireAdmin();
  const id = z.uuid().safeParse(generationId);
  if (!id.success || typeof accepted !== "boolean") return { ok: false };
  return { ok: await decideProductText(id.data, accepted) };
}

export async function testAiConnectionAction() {
  await requireAdmin();
  return testAiConnection();
}
