// Correspondance entre un nom de catégorie proposé (par l'IA) et les catégories existantes, pour éviter
// les doublons : « Outils à main » = « Outillage à main », « Produits d'entretien » = « Entretien »,
// « Peintures » = « Peinture ». Logique pure (testée par category-match.test.ts).
// Les vrais synonymes (« Nettoyage » ≈ « Entretien ») sont reconnus par l'IA, qui reçoit la liste ;
// ce module est le garde-fou déterministe côté serveur.
import { slugify } from "./slug";

export const CATEGORY_NAME_MAX = 60;

/** Petits mots ignorés. */
const STOPWORDS = new Set(["de", "des", "du", "d", "la", "le", "les", "l", "et", "a", "au", "aux", "en", "pour", "un", "une", "sur"]);
/** Mots génériques qui n'identifient pas une famille (« Produits d'entretien » = « Entretien »). */
const GENERIC = new Set(["produit", "article", "materiel", "fourniture", "equipement"]);
/** Variantes d'un même mot (après passage au singulier). */
const SAME_WORD: Record<string, string> = {
  outillage: "outil",
  jardinage: "jardin",
  electrique: "electricite",
  nettoyant: "nettoyage",
};

function singular(word: string): string {
  if (word.length > 3 && (word.endsWith("s") || word.endsWith("x"))) return word.slice(0, -1);
  return word;
}

/** Mots significatifs d'un nom de catégorie, normalisés (sans accents, au singulier, triés). */
export function categoryTokens(name: string): string[] {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map(singular)
    .map((w) => SAME_WORD[w] ?? w);
  const meaningful = words.filter((w) => !GENERIC.has(w));
  return [...new Set(meaningful.length ? meaningful : words)].sort();
}

/** Clé de comparaison : deux noms de même clé désignent la même catégorie. */
export function categoryKey(name: string): string {
  return categoryTokens(name).join(" ");
}

/** Catégorie existante équivalente au nom proposé (même clé, ou même adresse), sinon null. */
export function findSimilarCategory<T extends { name: string; slug: string }>(name: string, categories: readonly T[]): T | null {
  const key = categoryKey(name);
  const slug = slugify(name);
  if (!key && !slug) return null;
  return categories.find((c) => (key && categoryKey(c.name) === key) || (slug && c.slug === slug)) ?? null;
}

/** Nom propre pour une nouvelle catégorie : espaces, guillemets et ponctuation finale retirés, majuscule initiale. "" si inutilisable. */
export function cleanCategoryName(raw: string | null | undefined): string {
  const name = (raw ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/["«»“”]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.;:,!?]+$/, "")
    .slice(0, CATEGORY_NAME_MAX)
    .trim();
  if (name.length < 2 || !slugify(name)) return "";
  return name.charAt(0).toLocaleUpperCase("fr-FR") + name.slice(1);
}

/** Adresse libre pour une nouvelle catégorie : base, puis base-2, base-3… */
export function uniqueCategorySlug(name: string, taken: ReadonlySet<string>): string {
  const root = slugify(name).slice(0, 74).replace(/-+$/, "") || "categorie";
  if (!taken.has(root)) return root;
  for (let n = 2; ; n++) if (!taken.has(`${root}-${n}`)) return `${root}-${n}`;
}
