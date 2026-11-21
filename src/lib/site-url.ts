// Adresse publique du site (ex. https://www.droguerie-exemple.ma), variable SITE_URL du .env.
// Sert aux liens absolus : partage (Open Graph), sitemap, lien du produit dans le message WhatsApp.
// Vide ou invalide → null (les fonctionnalités qui en dépendent se désactivent proprement).
export function siteUrl(): URL | null {
  const raw = process.env.SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? new URL(url.origin) : null;
  } catch {
    return null;
  }
}

export function absoluteUrl(path: string): string | null {
  const base = siteUrl();
  return base ? new URL(path, base).toString() : null;
}
