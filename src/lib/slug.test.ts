import { describe, expect, it } from "vitest";
import { isValidSlug, slugify, SLUG_MAX_LENGTH } from "./slug";

describe("slugify", () => {
  it.each([
    ["Peinture", "peinture"],
    ["Produits d'entretien", "produits-d-entretien"],
    ["Éponge grattoir x10", "eponge-grattoir-x10"],
    ["  Quincaillerie & Outillage  ", "quincaillerie-outillage"],
    ["Hygiène / Bébé", "hygiene-bebe"],
    ["Ç'est l'été — ÀÉÎÕÜ", "c-est-l-ete-aeiou"],
    ["---", ""],
  ])("« %s » → « %s »", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("produit toujours un slug valide (ou vide)", () => {
    for (const input of ["Peinture", "A  B", "x".repeat(200), "a-".repeat(60), "!!!"]) {
      const slug = slugify(input);
      expect(slug === "" || isValidSlug(slug)).toBe(true);
    }
  });

  it(`ne dépasse jamais ${SLUG_MAX_LENGTH} caractères et ne finit pas par un tiret`, () => {
    const slug = slugify("mot ".repeat(50));
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("isValidSlug", () => {
  it.each(["peinture", "produits-d-entretien", "x10", "a-b-c"])("accepte « %s »", (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });
  it.each(["", "Peinture", "avec espace", "-debut", "fin-", "double--tiret", "accentué", "a/b", "x".repeat(81)])(
    "refuse « %s »",
    (slug) => {
      expect(isValidSlug(slug)).toBe(false);
    },
  );
});
