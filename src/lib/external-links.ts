// Validation des liens externes saisis dans les paramètres (Google Maps, réseaux sociaux).
// Logique pure : serveur (validation) + navigateur (aperçu).

export type LinkResult = { ok: true; value: string } | { ok: false; error: string };

function parseHttpsUrl(input: string): URL | null {
  try {
    const url = new URL(input.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * Lien d'intégration Google Maps.
 * Accepte l'URL seule OU le code <iframe …> complet copié depuis Google Maps
 * (on n'en garde que l'adresse src). Seul https://www.google.com/maps/embed… est accepté :
 * on ne stocke JAMAIS de HTML fourni par l'utilisateur (risque XSS).
 */
export function parseMapsEmbed(input: string): LinkResult {
  let candidate = input.trim();
  if (/^<iframe[\s>]/i.test(candidate)) {
    const src = candidate.match(/\ssrc\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!src) return { ok: false, error: "Code d'intégration sans adresse (src) : copiez à nouveau le code depuis Google Maps." };
    candidate = src.replace(/&amp;/g, "&");
  }
  const url = parseHttpsUrl(candidate);
  if (!url || !["www.google.com", "maps.google.com"].includes(url.hostname) || !url.pathname.startsWith("/maps/embed")) {
    return {
      ok: false,
      error: "Lien non valide. Dans Google Maps : Partager → Intégrer une carte → copiez le code (ou le lien https://www.google.com/maps/embed…).",
    };
  }
  if (url.href.length > 2000) return { ok: false, error: "Lien trop long." };
  return { ok: true, value: url.href };
}

export const SOCIAL_NETWORKS = {
  facebook: { label: "Facebook", hosts: ["facebook.com", "fb.com", "fb.me"] },
  instagram: { label: "Instagram", hosts: ["instagram.com"] },
  tiktok: { label: "TikTok", hosts: ["tiktok.com"] },
} as const;

export type SocialNetwork = keyof typeof SOCIAL_NETWORKS;

/** Lien de page sur un réseau social : https et domaine du réseau (ou sous-domaine : www., m.…). */
export function parseSocialUrl(network: SocialNetwork, input: string): LinkResult {
  const { label, hosts } = SOCIAL_NETWORKS[network];
  const raw = input.trim();
  // Saisie sans protocole (« facebook.com/ma-page ») : on ajoute https://.
  const url = parseHttpsUrl(/^https?:\/\//i.test(raw) ? raw.replace(/^http:/i, "https:") : `https://${raw}`);
  const hostOk = url && hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  if (!url || !hostOk || url.pathname === "/" || url.username || url.password) {
    return { ok: false, error: `Lien ${label} invalide (ex. https://www.${hosts[0]}/votre-page).` };
  }
  if (url.href.length > 300) return { ok: false, error: "Lien trop long." };
  return { ok: true, value: url.href };
}
