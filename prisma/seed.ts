// ─────────────────────────────────────────────────────────────────────────────
// Données initiales de la base.  Lancer : npm run db:seed
//
// IDEMPOTENT : on peut le relancer sans créer de doublons ni écraser les
// modifications faites depuis l'admin (on crée seulement ce qui manque).
//
//  1. Paramètres du magasin (toujours)       — textes de démonstration
//  2. Compte administrateur (si ADMIN_* défini) — jamais de mot de passe dans le code
//  3. Données de démo (si SEED_DEMO_DATA=true) — catégories, produits, numéro WhatsApp
//     → à NE PAS activer en production.
// ─────────────────────────────────────────────────────────────────────────────
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword, PASSWORD_MIN_LENGTH } from "../src/lib/password";
import { slugify } from "../src/lib/slug";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Préfixe visible : impossible de laisser passer un texte de démo en production sans le voir.
const DEMO = "[À REMPLACER]";

async function seedStoreSettings() {
  await prisma.storeSettings.upsert({
    where: { id: 1 },
    update: {}, // ne jamais écraser ce que le client a saisi dans l'admin
    create: {
      id: 1,
      storeName: "Droguerie",
      heroTitle: `${DEMO} Votre droguerie de confiance`,
      heroSubtitle: `${DEMO} Produits d'entretien, peinture, quincaillerie et outillage pour les professionnels et les particuliers.`,
      heroCtaLabel: "Voir le catalogue",
      aboutText: `${DEMO} Présentation du magasin : histoire, savoir-faire, engagement qualité. Ce texte est modifiable depuis l'espace administrateur.`,
      address: `${DEMO} Adresse du magasin, Ville, Maroc`,
      openingHours: `${DEMO} Lundi – Samedi : 9h00 – 19h00`,
      seoTitle: "Droguerie — Catalogue de produits",
      seoDescription: `${DEMO} Découvrez notre catalogue et demandez les prix directement sur WhatsApp.`,
    },
  });
  console.log("✔ Paramètres du magasin");
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrateur";

  if (!email || !password) {
    console.log("… Compte admin ignoré (ADMIN_EMAIL / ADMIN_PASSWORD non définis)");
    return;
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`ADMIN_PASSWORD doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`);
  }

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    // On ne réinitialise jamais un mot de passe existant depuis le seed.
    console.log(`… Compte admin ${email} déjà présent (inchangé)`);
    return;
  }

  await prisma.adminUser.create({
    data: { email, name, passwordHash: await hashPassword(password) },
  });
  console.log(`✔ Compte admin créé : ${email}`);
}

const DEMO_CATALOG: Record<string, { description: string; products: string[] }> = {
  Entretien: {
    description: "Produits d'entretien et de nettoyage.",
    products: ["Éponge grattoir double face x10", "Détergent multi-surfaces 5 L", "Serpillière microfibre"],
  },
  Peinture: {
    description: "Peintures, vernis et accessoires.",
    products: ["Peinture acrylique blanc mat 10 L", "Rouleau anti-goutte 180 mm", "Ruban de masquage 50 m"],
  },
  Quincaillerie: {
    description: "Visserie, fixations et petite quincaillerie.",
    products: ["Vis à bois tête fraisée 4x40 (boîte de 200)", "Chevilles nylon 8 mm x100", "Cadenas laiton 40 mm"],
  },
  Outillage: {
    description: "Outils à main et accessoires.",
    products: ["Tournevis cruciforme PH2", "Mètre ruban 5 m", "Pinceau plat 50 mm"],
  },
};

async function seedDemoData() {
  if (process.env.SEED_DEMO_DATA !== "true") {
    console.log("… Données de démo ignorées (SEED_DEMO_DATA ≠ true)");
    return;
  }

  // Numéro manifestement fictif : il devra être remplacé dans l'admin.
  const whatsapp = await prisma.whatsappNumber.upsert({
    where: { phone: "212600000000" },
    update: {},
    create: { label: `${DEMO} Numéro principal du magasin`, phone: "212600000000", isDefault: true },
  });

  let sortOrder = 0;
  let productCount = 0;
  for (const [categoryName, { description, products }] of Object.entries(DEMO_CATALOG)) {
    const category = await prisma.category.upsert({
      where: { slug: slugify(categoryName) },
      update: {},
      create: {
        name: categoryName,
        slug: slugify(categoryName),
        description,
        sortOrder: sortOrder++,
        // Seule la 1re catégorie a un numéro explicite ; les autres testent le repli « par défaut ».
        whatsappNumberId: sortOrder === 1 ? whatsapp.id : null,
      },
    });

    for (const [index, productName] of products.entries()) {
      // 1er produit de chaque catégorie : mis en avant ; dernier : brouillon (test de l'aperçu).
      const isDraft = index === products.length - 1;
      await prisma.product.upsert({
        where: { slug: slugify(productName) },
        update: {},
        create: {
          name: productName,
          slug: slugify(productName),
          description: `${DEMO} Description commerciale de « ${productName} ».`,
          categoryId: category.id,
          status: isDraft ? "DRAFT" : "PUBLISHED",
          publishedAt: isDraft ? null : new Date(),
          isFeatured: index === 0,
          featuredOrder: index === 0 ? sortOrder : null,
        },
      });
      productCount++;
    }
  }
  console.log(`✔ Démo : 1 numéro WhatsApp, ${sortOrder} catégories, ${productCount} produits`);
}

async function main() {
  await seedStoreSettings();
  await seedAdmin();
  await seedDemoData();
}

main()
  .catch((error) => {
    console.error("✖ Échec du seed :", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
