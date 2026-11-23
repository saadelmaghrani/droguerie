// Import de produits de DÉMONSTRATION depuis un fichier JSON (base de développement uniquement).
//
//   npm run import:demo -- <fichier.json>
//
// Format : [{ sourceId, name, category, specs: string[], image: "/chemin/photo.jpg", sourceUrl? }]
// - Catégories créées si absentes (pictogramme suggéré automatiquement).
// - Référence « OM-<sourceId> » : relancer le script met à jour au lieu de créer des doublons.
// - Photo principale traitée comme dans l'admin (détourage fond blanc, WebP 320/800/1600, sans métadonnées) ; produit publié
//   seulement s'il a sa photo (règle « photo obligatoire »).
// - Descriptions RÉDIGÉES ici à partir des caractéristiques (faits), pas recopiées.
//
// ⚠️ Les photos de sites tiers restent protégées par le droit d'auteur : réservé aux tests locaux,
//    à remplacer par les photos du magasin avant toute mise en ligne.
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { processProductPhoto } from "@/server/products/studio-photo";
import { addProductImage } from "@/server/products/images-service";
import { brandFromName, cleanName, writeDescription } from "./demo-product-text";

type Item = { sourceId: string; name: string; category: string; specs: string[]; image: string; sourceUrl?: string };

async function categoryId(name: string): Promise<string> {
  const existing = await prisma.category.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  if (existing) return existing.id;
  const last = await prisma.category.aggregate({ _max: { sortOrder: true } });
  const created = await prisma.category.create({
    data: { name, slug: slugify(name), sortOrder: (last._max.sortOrder ?? -1) + 1, isActive: true },
    select: { id: true },
  });
  console.log(`  + catégorie « ${name} »`);
  return created.id;
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Import de démonstration interdit en production.");
  const file = process.argv[2];
  if (!file) throw new Error("Usage : npm run import:demo -- <fichier.json>");
  const items = JSON.parse(readFileSync(file, "utf8")) as Item[];
  let created = 0;
  let updated = 0;
  let photos = 0;
  const slugs = new Set((await prisma.product.findMany({ select: { slug: true } })).map((p) => p.slug));

  for (const item of items) {
    const name = cleanName(item.name).slice(0, 120);
    const reference = `OM-${item.sourceId}`;
    const data = {
      name,
      brand: brandFromName(name),
      description: writeDescription(name, item.category, item.specs ?? []),
      categoryId: await categoryId(item.category),
    };
    const existing = await prisma.product.findFirst({ where: { reference }, select: { id: true, slug: true, _count: { select: { images: true } } } });
    let productId: string;
    let hasPhoto: boolean;
    if (existing) {
      await prisma.product.update({ where: { id: existing.id }, data });
      productId = existing.id;
      hasPhoto = existing._count.images > 0;
      updated++;
    } else {
      let slug = slugify(name) || "produit";
      for (let n = 2; slugs.has(slug); n++) slug = `${slugify(name)}-${n}`;
      slugs.add(slug);
      const product = await prisma.product.create({ data: { ...data, slug, reference, status: "DRAFT" }, select: { id: true } });
      productId = product.id;
      hasPhoto = false;
      created++;
    }

    if (!hasPhoto) {
      const buffer = readFileSync(item.image);
      // Même traitement que l'admin : détourage + fond blanc studio (originale conservée).
      const processed = await processProductPhoto(new File([new Uint8Array(buffer)], "photo.jpg", { type: "image/jpeg" }), productId, name);
      if (processed.ok && (await addProductImage(productId, processed.photo)).ok) {
        hasPhoto = true;
        photos++;
        if (processed.notice) console.warn(`  ! ${name} : ${processed.notice}`);
      } else console.warn(`  ! photo refusée pour « ${name} » : ${processed.ok ? "enregistrement" : processed.error}`);
    }
    // Photo obligatoire pour publier : sans photo, le produit reste en brouillon.
    if (hasPhoto) {
      const current = await prisma.product.findUnique({ where: { id: productId }, select: { publishedAt: true } });
      await prisma.product.update({ where: { id: productId }, data: { status: "PUBLISHED", publishedAt: current?.publishedAt ?? new Date() } });
    }
    console.log(`${existing ? "↻" : "✔"} ${name}${hasPhoto ? "" : "  (brouillon : pas de photo)"}`);
  }
  console.log(`\n${created} créés · ${updated} mis à jour · ${photos} photos ajoutées`);
  console.log("Le site public se met à jour après la prochaine modification dans l'admin ou un redémarrage de « npm run dev ».");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
