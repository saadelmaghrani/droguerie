"use server";
// Actions serveur de l'import CSV. Points d'entrée publics : requireAdmin() en premier,
// AVANT de lire le fichier envoyé.

import { refresh } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/server/auth/dal";
import { analyzeCsv, importCsv, type AnalysisResult, type ImportResult } from "./import";

function fileFrom(formData: unknown): File | null {
  if (!(formData instanceof FormData)) return null;
  const file = formData.get("file");
  return file instanceof File ? file : null;
}

export async function analyzeProductImport(formData: FormData): Promise<AnalysisResult> {
  await requireAdmin();
  const file = fileFrom(formData);
  if (!file) return { ok: false, message: "Aucun fichier reçu." };
  return analyzeCsv(file);
}

export async function runProductImport(formData: FormData): Promise<ImportResult> {
  await requireAdmin();
  const file = fileFrom(formData);
  if (!file) return { ok: false, message: "Aucun fichier reçu." };
  try {
    const result = await importCsv(file);
    if (result.ok) refresh();
    return result;
  } catch (error) {
    // Transaction annulée : rien n'a été écrit.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ok: false,
        message: "Une référence vient d'être utilisée par un autre produit pendant l'import. Rien n'a été importé : relancez l'analyse.",
      };
    }
    throw error;
  }
}
