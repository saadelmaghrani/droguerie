// Transforme un nom en identifiant d'URL lisible (« slug »).
//   « Éponge grattoir x10 » → « eponge-grattoir-x10 »
export function slugify(input: string): string {
  return input
    .normalize("NFD") // sépare les lettres de leurs accents (é → e + ´)
    .replace(/[̀-ͯ]/g, "") // supprime les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // tout ce qui n'est pas lettre/chiffre → tiret
    .replace(/^-+|-+$/g, "") // pas de tiret au début ni à la fin
    .slice(0, 80);
}
