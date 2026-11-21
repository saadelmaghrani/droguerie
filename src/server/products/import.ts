// Import CSV des produits (sans authentification : appelé par import-actions.ts,
// qui vérifie l'admin AVANT). Deux temps, sans fichier temporaire :
//   1. analyse  : le fichier est lu et validé, rien n'est écrit ;
//   2. import   : le MÊME fichier est renvoyé, ré-analysé (la base a pu changer entre-temps),
//                 puis les lignes valides sont écrites en UNE transaction (tout ou rien).
import "server-only";

import { decodeCsvBytes, parseCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_ROWS,
  mapHeader,
  validateImportRows,
  type ImportRow,
} from "@/lib/product-import";
import { slugify } from "@/lib/slug";

export type ImportAnalysis = {
  rows: ImportRow[];
  ignoredColumns: string[];
  priceColumns: string[];
  counts: { create: number; update: number; error: number };
};

export type AnalysisResult = { ok: true; analysis: ImportAnalysis } | { ok: false; message: string };
export type ImportResult = { ok: true; created: number; updated: number; skipped: number } | { ok: false; message: string };

const MB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
const FIELD_LABELS = { name: "Nom", category: "Catégorie" } as const;

export async function analyzeCsv(file: File): Promise<AnalysisResult> {
  if (file.size === 0) return { ok: false, message: "Le fichier est vide." };
  if (file.size > IMPORT_MAX_BYTES) {
    return { ok: false, message: `Fichier trop lourd (${MB(file.size)}). Maximum : ${MB(IMPORT_MAX_BYTES)}.` };
  }
  if (!/\.(csv|txt)$/i.test(file.name)) {
    return {
      ok: false,
      message: "Ce fichier n'est pas un CSV. Dans Excel : Fichier › Enregistrer sous › « CSV (séparateur : point-virgule) ».",
    };
  }

  const text = decodeCsvBytes(new Uint8Array(await file.arrayBuffer()));
  if (text.includes("\u0000")) return { ok: false, message: "Ce fichier n'est pas un CSV lisible (fichier Excel .xlsx renommé ?)." };
  const [header, ...records] = parseCsv(text);
  if (!header) return { ok: false, message: "Le fichier est vide." };
  if (records.length === 0) return { ok: false, message: "Le fichier ne contient que la ligne d'en-tête : aucun produit à importer." };
  if (records.length > IMPORT_MAX_ROWS) {
    return { ok: false, message: `Trop de lignes (${records.length}). Maximum : ${IMPORT_MAX_ROWS} par fichier : découpez-le.` };
  }

  const mapping = mapHeader(header.cells);
  if (mapping.missing.length > 0) {
    const names = mapping.missing.map((f) => `« ${FIELD_LABELS[f as keyof typeof FIELD_LABELS]} »`).join(" et ");
    return {
      ok: false,
      message: `Colonne ${names} introuvable sur la 1re ligne. Utilisez le modèle : la 1re ligne doit contenir les titres des colonnes.`,
    };
  }
  if (mapping.duplicated.length > 0) {
    return { ok: false, message: `Colonne en double : « ${mapping.duplicated.join(" », « ")} ». Supprimez-la et réessayez.` };
  }

  const [categories, existing] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.product.findMany({ where: { reference: { not: null } }, select: { id: true, name: true, reference: true } }),
  ]);
  const rows = validateImportRows(
    records,
    mapping.columns,
    categories,
    existing.map((p) => ({ id: p.id, name: p.name, reference: p.reference! })),
  );
  const counts = { create: 0, update: 0, error: 0 };
  for (const row of rows) counts[row.action]++;
  return { ok: true, analysis: { rows, ignoredColumns: mapping.ignored, priceColumns: mapping.priceColumns, counts } };
}

/** Adresses libres pour les nouveaux produits : base, base-2, base-3… (calculées en mémoire). */
function slugAllocator(taken: Set<string>) {
  return (name: string) => {
    const root = slugify(name).slice(0, 74).replace(/-+$/, "") || "produit";
    let slug = root;
    for (let n = 2; taken.has(slug); n++) slug = `${root}-${n}`;
    taken.add(slug);
    return slug;
  };
}

export async function importCsv(file: File): Promise<ImportResult> {
  const analyzed = await analyzeCsv(file);
  if (!analyzed.ok) return analyzed;
  const { rows, counts } = analyzed.analysis;
  if (counts.create + counts.update === 0) return { ok: false, message: "Aucune ligne valide à importer." };

  await prisma.$transaction(
    async (tx) => {
      const now = new Date();
      const nextSlug = slugAllocator(new Set((await tx.product.findMany({ select: { slug: true } })).map((p) => p.slug)));

      const creates = rows.flatMap((row) => (row.action === "create" ? [row.data] : []));
      if (creates.length > 0) {
        await tx.product.createMany({
          data: creates.map((d) => ({
            name: d.name!,
            slug: nextSlug(d.name!),
            categoryId: d.categoryId!,
            description: d.description ?? null,
            reference: d.reference ?? null,
            brand: d.brand ?? null,
            status: d.status ?? "DRAFT",
            isFeatured: d.isFeatured ?? false,
            publishedAt: d.status === "PUBLISHED" ? now : null,
          })),
        });
      }

      const updates = rows.flatMap((row) => (row.action === "update" ? [row] : []));
      const publishedAt = new Map(
        (
          await tx.product.findMany({
            where: { id: { in: updates.map((u) => u.productId) } },
            select: { id: true, publishedAt: true },
          })
        ).map((p) => [p.id, p.publishedAt]),
      );
      for (const { productId, data: d } of updates) {
        // Cellule vide = valeur inchangée (undefined est ignoré par Prisma).
        // L'adresse (slug) n'est jamais modifiée par l'import : les liens partagés restent valides.
        await tx.product.update({
          where: { id: productId },
          data: {
            name: d.name,
            categoryId: d.categoryId,
            description: d.description,
            // La référence sert à retrouver le produit : elle n'est pas réécrite (pas même ses majuscules).
            brand: d.brand,
            status: d.status,
            isFeatured: d.isFeatured,
            publishedAt: publishedAt.get(productId) ?? (d.status === "PUBLISHED" ? now : undefined),
          },
        });
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  return { ok: true, created: counts.create, updated: counts.update, skipped: counts.error };
}
