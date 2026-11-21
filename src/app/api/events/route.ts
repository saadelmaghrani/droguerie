// POST /api/events — reçoit les visites et clics WhatsApp envoyés par le site (navigator.sendBeacon).
// Répond toujours 204 (rien à renvoyer au navigateur) ; les requêtes invalides sont simplement ignorées.
import { cleanPath, isBot } from "@/lib/analytics";
import { recordEvent } from "@/server/analytics/ingest";
import { STATS_IGNORE_COOKIE_NAME } from "@/server/auth/cookie";

const NO_CONTENT = () => new Response(null, { status: 204 });

export async function POST(request: Request) {
  const userAgent = request.headers.get("user-agent") ?? "";
  // Robots et appareils du magasin (cookie posé à la connexion admin) : jamais comptés.
  if (isBot(userAgent)) return NO_CONTENT();
  if ((request.headers.get("cookie") ?? "").split(/;\s*/).includes(`${STATS_IGNORE_COOKIE_NAME}=1`)) return NO_CONTENT();
  // Préchargement de page par le navigateur : pas une vraie visite.
  if (request.headers.get("sec-purpose")?.includes("prefetch")) return NO_CONTENT();

  const raw = await request.text();
  if (raw.length > 2000) return NO_CONTENT();
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NO_CONTENT();
  }
  const { t, p, r } = (body ?? {}) as { t?: unknown; p?: unknown; r?: unknown };
  const path = cleanPath(p);
  if ((t !== "pageview" && t !== "whatsapp") || !path) return NO_CONTENT();

  // Derrière Caddy, l'adresse du visiteur est dans X-Forwarded-For (première valeur).
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const ownHost = request.headers.get("host")?.split(":")[0] ?? null;

  try {
    await recordEvent({ kind: t, path, referrer: typeof r === "string" ? r.slice(0, 500) : null }, { ip, userAgent, ownHost });
  } catch (error) {
    console.error("[statistiques] enregistrement impossible :", error);
  }
  return NO_CONTENT();
}
