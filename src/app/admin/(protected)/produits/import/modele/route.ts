// Modèle CSV à remplir dans Excel : /admin/produits/import/modele
// Point-virgule + BOM UTF-8 : Excel en français l'ouvre directement, accents compris.
import { toCsv } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { TEMPLATE_HEADERS } from "@/lib/product-import";
import { requireAdmin } from "@/server/auth/dal";

export async function GET() {
  await requireAdmin();
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true },
    take: 2,
  });
  const [first = "Peinture", second = first] = categories.map((c) => c.name);

  const csv = toCsv([
    TEMPLATE_HEADERS,
    ["Éponge grattoir double face x10", first, "Lot de 10 éponges.\nFace abrasive pour les casseroles.", "EP-010", "Spontex", "Publié", "Non"],
    ["Seau plastique 10 L", second, "", "", "", "Brouillon", ""],
  ]);
  return new Response("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modele-import-produits.csv"',
      "Cache-Control": "no-store",
    },
  });
}
