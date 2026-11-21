// Connexion unique à la base de données, partagée par toute l'application.
//
// « server-only » provoque une erreur de compilation si ce fichier est importé
// par erreur dans un composant client : la base n'est jamais exposée au navigateur.
import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL n'est pas défini (voir .env.example).");
  }
  // Prisma 7 passe par un « driver adapter » : ici le pilote PostgreSQL officiel (pg).
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// En développement, Next.js recharge les modules à chaque modification de fichier.
// Sans ce cache global, chaque rechargement ouvrirait un nouveau pool de connexions
// et finirait par saturer PostgreSQL. En production, le module n'est chargé qu'une fois.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
