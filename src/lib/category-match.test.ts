import { describe, expect, it } from "vitest";
import { categoryKey, cleanCategoryName, findSimilarCategory, uniqueCategorySlug } from "./category-match";

const existing = [
  { name: "Entretien", slug: "entretien" },
  { name: "Peinture", slug: "peinture" },
  { name: "Outillage", slug: "outillage" },
  { name: "Outillage électroportatif", slug: "outillage-electroportatif" },
  { name: "Outillage à main", slug: "outillage-a-main" },
  { name: "Mesure et traçage", slug: "mesure-et-tracage" },
  { name: "Jardinage", slug: "jardinage" },
  { name: "Sécurité et EPI", slug: "securite-et-epi" },
];

describe("categoryKey", () => {
  it("ignore accents, majuscules, pluriels, petits mots et mots génériques", () => {
    expect(categoryKey("Sécurité & EPI")).toBe(categoryKey("securite et epi"));
    expect(categoryKey("Peintures")).toBe("peinture");
    expect(categoryKey("Pinceaux")).toBe("pinceau");
    expect(categoryKey("Produits d'entretien")).toBe("entretien");
    expect(categoryKey("Traçage et mesure")).toBe(categoryKey("Mesure et traçage"));
  });
  it("variantes d'un même mot", () => {
    expect(categoryKey("Outils")).toBe(categoryKey("Outillage"));
    expect(categoryKey("Jardin")).toBe(categoryKey("Jardinage"));
  });
  it("mots courts conservés tels quels", () => {
    expect(categoryKey("Gaz")).toBe("gaz");
    expect(categoryKey("Vis")).toBe("vis");
  });
  it("nom fait uniquement de mots génériques : gardé", () => {
    expect(categoryKey("Produits")).toBe("produit");
    expect(categoryKey("Matériels et fournitures")).toBe("fourniture materiel");
  });
});

describe("findSimilarCategory", () => {
  it.each([
    ["Outils à main", "Outillage à main"],
    ["outillage electroportatif", "Outillage électroportatif"],
    ["Outils", "Outillage"],
    ["Produits d'entretien", "Entretien"],
    ["Matériel de jardinage", "Jardinage"],
    ["Peintures", "Peinture"],
    ["Traçage et mesure", "Mesure et traçage"],
  ])("« %s » → « %s »", (proposed, expected) => {
    expect(findSimilarCategory(proposed, existing)?.name).toBe(expected);
  });
  it.each(["Plomberie", "Colles et adhésifs", "Accessoires de peinture", "Électricité", "Outillage de jardin", "Visserie"])(
    "« %s » → aucune (catégorie réellement différente)",
    (proposed) => {
      expect(findSimilarCategory(proposed, existing)).toBeNull();
    },
  );
  it("même adresse → même catégorie", () => {
    expect(findSimilarCategory("peinture", [{ name: "Peinture (intérieur)", slug: "peinture" }])?.slug).toBe("peinture");
  });
});

describe("cleanCategoryName", () => {
  it("nettoie et met une majuscule", () => {
    expect(cleanCategoryName("  « colles   et adhésifs ».  ")).toBe("Colles et adhésifs");
    expect(cleanCategoryName("électricité")).toBe("Électricité");
  });
  it("inutilisable → vide", () => {
    expect(cleanCategoryName("")).toBe("");
    expect(cleanCategoryName(" x ")).toBe("");
    expect(cleanCategoryName("…!!")).toBe("");
    expect(cleanCategoryName(null)).toBe("");
  });
  it("60 caractères maximum", () => {
    expect(cleanCategoryName("a".repeat(100))).toHaveLength(60);
  });
});

describe("uniqueCategorySlug", () => {
  it("adresse libre, sinon suffixe", () => {
    expect(uniqueCategorySlug("Colles et adhésifs", new Set())).toBe("colles-et-adhesifs");
    expect(uniqueCategorySlug("Plomberie", new Set(["plomberie", "plomberie-2"]))).toBe("plomberie-3");
    expect(uniqueCategorySlug("!!!", new Set())).toBe("categorie");
  });
});

describe("familles et énumérations (pas de doublon « Vis » / « Visserie »)", () => {
  const families = [
    { name: "Visserie", slug: "visserie" },
    { name: "Colles et adhésifs", slug: "colles-et-adhesifs" },
    { name: "Chevilles & fixations", slug: "chevilles-fixations" },
    { name: "Éclairage", slug: "eclairage" },
    { name: "Outillage", slug: "outillage" },
    { name: "Accessoires de peinture", slug: "accessoires-de-peinture" },
  ];
  it.each([
    ["Vis", "Visserie"],
    ["vis", "Visserie"],
    ["Boulonnerie et visserie", "Visserie"],
    ["Colles", "Colles et adhésifs"],
    ["Adhésifs", "Colles et adhésifs"],
    ["Chevilles", "Chevilles & fixations"],
    ["Ampoules", "Éclairage"],
    ["Luminaires", "Éclairage"],
  ])("« %s » → « %s » (existe déjà)", (proposed, expected) => {
    expect(findSimilarCategory(proposed, families)?.name).toBe(expected);
  });
  it.each(["Outillage à main", "Peinture", "Plomberie", "Boulonnerie", "Fixations murales"])(
    "« %s » → nouvelle (plus précise ou différente, pas un doublon)",
    (proposed) => {
      expect(findSimilarCategory(proposed, families)).toBeNull();
    },
  );
  it("sans « Visserie », « Vis » n'est pas rattachée à « Quincaillerie »", () => {
    expect(findSimilarCategory("Vis", existing)).toBeNull();
  });
});
