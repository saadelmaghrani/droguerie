// Textes des produits de démonstration (import:demo) : nom lisible, marque, description rédigée.
// Logique pure, testée par demo-product-text.test.ts.

export const BRANDS: Record<string, string> = {
  worksite: "Worksite", kraftmuller: "Kraftmuller", total: "Total", ingco: "Ingco", bosch: "Bosch", makita: "Makita",
  stanley: "Stanley", dewalt: "DeWalt", einhell: "Einhell", tolsen: "Tolsen", ford: "Ford", emtop: "Emtop", ronix: "Ronix",
};

/** Unités isolées (« 0,8 L », « 500 W ») : écriture correcte. */
const UNITS: Record<string, string> = { l: "L", w: "W", v: "V", kw: "kW", ah: "Ah" };
const ACRONYMS = new Set(["HVLP", "SDS", "UV", "EPI", "LED", "PVC", "HSS", "MDF"]);

/**
 * Nom lisible : « PERCEUSE A PERCUSSION 13mm 800W » → « Perceuse a percussion 13mm 800W ».
 * Mots en capitales → minuscules, SAUF unités / modèles (contiennent un chiffre), sigles et marques.
 */
export function cleanName(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim();
  const letters = name.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const upper = letters.replace(/[^A-ZÀ-Þ]/g, "");
  const shouting = letters.length > 0 && upper.length / letters.length > 0.6;
  const words = name.split(" ").map((word) => {
    const bare = word.replace(/[^A-Za-zÀ-ÿ0-9]/g, "");
    const brand = BRANDS[bare.toLowerCase()];
    if (brand) return word.replace(bare, brand);
    if (ACRONYMS.has(bare.toUpperCase())) return word.replace(bare, bare.toUpperCase());
    const unit = UNITS[bare.toLowerCase()];
    if (unit) return word.replace(bare, unit);
    if (/\d/.test(word)) return word.replace(/(\d)W\b/i, "$1W").replace(/(\d)V\b/i, "$1V").replace(/(\d)L\b/, "$1 L");
    return shouting ? word.toLowerCase() : word;
  });
  const result = words.join(" ");
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export function brandFromName(name: string): string | null {
  const lower = name.toLowerCase();
  const key = Object.keys(BRANDS).find((b) => new RegExp(`(^|[^a-z])${b}([^a-z]|$)`).test(lower));
  return key ? BRANDS[key]! : null;
}

export function writeDescription(name: string, category: string, specs: string[]): string {
  const lines = [...new Set(specs.map((s) => s.replace(/\s*:\s*/, " : ").trim()))].filter((s) => s.length > 3).slice(0, 8);
  const intro = `${name}, disponible dans notre rayon ${category.toLowerCase()}.`;
  const outro = "Prix et disponibilité sur demande : contactez-nous sur WhatsApp.";
  return lines.length ? `${intro}\n\nCaractéristiques :\n${lines.map((l) => `- ${l}`).join("\n")}\n\n${outro}` : `${intro}\n\n${outro}`;
}

