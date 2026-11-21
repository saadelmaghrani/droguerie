// Statistiques de visite : règles pures (serveur), testées par analytics.test.ts.
//
// Respect de la vie privée, sans bandeau cookies :
//  - aucun cookie, aucun stockage dans le navigateur ;
//  - le visiteur est un « hachage » de (IP + navigateur + sel du jour) : impossible de retrouver l'IP,
//    et le sel change chaque jour (on ne peut pas suivre une personne d'un jour à l'autre) ;
//  - la provenance (referrer) est réduite au nom du site (google.com), jamais l'adresse complète.

const BOT_PATTERN =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|preview|headless|lighthouse|pagespeed|curl|wget|python|axios|node-fetch|go-http|java\//i;

/** Robots, aperçus de liens (WhatsApp, Facebook…), outils automatiques : jamais comptés. */
export function isBot(userAgent: string | null | undefined): boolean {
  return !userAgent || userAgent.length < 10 || BOT_PATTERN.test(userAgent);
}

export type DeviceType = "mobile" | "tablet" | "desktop";

export function deviceType(userAgent: string): DeviceType {
  if (/ipad|tablet|kindle|silk|playbook|(android(?!.*mobile))/i.test(userAgent)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(userAgent)) return "mobile";
  return "desktop";
}

/** Provenance : nom du site extérieur uniquement (null si même site, absent ou invalide). */
export function referrerHost(referrer: string | null | undefined, ownHost: string | null): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    if (!host || (ownHost && host === ownHost.replace(/^www\./, "").toLowerCase())) return null;
    return host.slice(0, 100);
  } catch {
    return null;
  }
}

export type PageKind = { kind: "product" | "category"; slug: string } | { kind: "other" };

/** Nature de la page visitée, d'après son adresse (sans paramètres). */
export function classifyPath(path: string): PageKind {
  const product = path.match(/^\/produits\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  if (product) return { kind: "product", slug: product[1]! };
  const category = path.match(/^\/categories\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  if (category) return { kind: "category", slug: category[1]! };
  return { kind: "other" };
}

/** Adresse acceptée : page publique du site, sans paramètres, 200 caractères max. */
export function cleanPath(input: unknown): string | null {
  if (typeof input !== "string" || !input.startsWith("/") || input.startsWith("//")) return null;
  const path = input.split(/[?#]/)[0]!.slice(0, 200);
  if (/^\/(admin|api|media|_next)(\/|$)/.test(path)) return null;
  return path;
}

/** Une visite (session) se termine après 30 minutes sans activité. */
export const SESSION_GAP_MS = 30 * 60 * 1000;

/** Date du jour au Maroc (AAAA-MM-JJ), pour le sel quotidien et les regroupements. */
export function moroccoDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Variation en % par rapport à la période précédente (null si pas de base de comparaison). */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}
