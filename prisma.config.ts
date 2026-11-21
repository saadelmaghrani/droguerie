// Configuration de l'outil en ligne de commande Prisma (migrations, generate, studio).
// Prisma 7 ne lit plus automatiquement le .env : dotenv le charge ici.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
