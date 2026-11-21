// GET /api/health — indique si l'application et la base de données répondent.
// Servira aussi en production : Docker et la supervision interrogeront cette URL.
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // Force l'exécution à chaque requête (jamais pré-calculée au build).
  await connection();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "up" });
  } catch (error) {
    // Le détail de l'erreur reste dans les logs serveur, jamais dans la réponse publique.
    console.error("[health] base de données injoignable :", error);
    return Response.json({ status: "error", database: "down" }, { status: 503 });
  }
}
