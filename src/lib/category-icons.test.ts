import { describe, expect, it } from "vitest";
import { categoryIconKey, suggestCategoryIcon } from "./category-icons";

describe("suggestCategoryIcon", () => {
  it.each([
    ["Entretien", "sparkles"],
    ["Peinture", "paint-roller"],
    ["Quincaillerie", "nut"],
    ["Outillage", "hammer"],
    ["Jardinage & Plein Air", "sprout"],
    ["Piscines", "waves-ladder"],
    ["Animalerie", "paw-print"],
    ["Sanitaire", "shower-head"],
    ["Équipement cuisine & articles ménagers", "cooking-pot"],
    ["Rangement de maison", "boxes"],
    ["Décoration", "sofa"],
    ["Chauffage & Climatisation", "flame"],
    ["Revêtement des sols", "layout-grid"],
    ["Luminaire", "lightbulb"],
    ["Électricité", "zap"],
    ["Accessoires téléphone & connectique", "smartphone"],
    ["Catégorie inconnue", "package"],
  ])("« %s » → %s", (name, icon) => expect(suggestCategoryIcon(name)).toBe(icon));
});

describe("categoryIconKey", () => {
  it("choix de l'admin prioritaire", () => expect(categoryIconKey("lock", "Peinture")).toBe("lock"));
  it("valeur inconnue ou vide → suggestion", () => {
    expect(categoryIconKey("n-existe-pas", "Peinture")).toBe("paint-roller");
    expect(categoryIconKey(null, "Peinture")).toBe("paint-roller");
  });
});
