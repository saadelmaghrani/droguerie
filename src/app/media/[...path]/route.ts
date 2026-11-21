// GET /media/<clé>-<taille>.webp — sert les images enregistrées (dossier UPLOAD_DIR).
// En production, Caddy pourra servir ce dossier directement (plus rapide) ; cette route
// reste le comportement de référence et fonctionne partout.
import { connection } from "next/server";
import { localStorage } from "@/server/media/storage";

// Seuls les noms produits par le serveur sont acceptés : aucun « .. », aucune autre extension.
const ALLOWED = /^(products\/[0-9a-f-]{36}|settings\/(logo|hero))\/[0-9a-f]{32}-(\d{3,4}|orig)\.webp$/;

export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  await connection(); // lecture disque à chaque requête (jamais pendant le build)
  const file = (await params).path.join("/");
  if (!ALLOWED.test(file)) return new Response("Introuvable", { status: 404 });

  const data = await localStorage.read(file);
  if (!data) return new Response("Introuvable", { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(data.length),
      // Une clé n'est jamais réutilisée : le fichier ne change jamais → cache d'un an.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
