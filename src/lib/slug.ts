// Identifiants d'URL lisibles (« slugs ») : « Éponge grattoir x10 » → « eponge-grattoir-x10 ».
// Logique pure : utilisée côté serveur (validation) et navigateur (aperçu en direct).

export const SLUG_MAX_LENGTH = 80;

export function slugify(input: string): string {
  return input
    .normalize("NFD") // sépare les lettres de leurs accents (é → e + ´)
    .replace(/[̀-ͯ]/g, "") // supprime les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // tout ce qui n'est pas lettre/chiffre → tiret
    .replace(/^-+|-+$/g, "") // pas de tiret au début ni à la fin
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, ""); // la coupe ne doit pas laisser de tiret final
}

/** Minuscules, chiffres et tirets simples ; ni tiret au début, ni à la fin. */
export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= SLUG_MAX_LENGTH && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}
