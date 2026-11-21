import { describe, expect, it } from "vitest";
import { brandFromName, cleanName, writeDescription } from "./demo-product-text";

describe("cleanName", () => {
  it.each([
    ["PERCEUSE A PERCUSSION 13mm 800W", "Perceuse a percussion 13mm 800W"],
    ["PISTOLET peinture TOTAL HVLP 0,8 L 500 W reservoir ALUMINIUM", "Pistolet peinture Total HVLP 0,8 L 500 W reservoir aluminium"],
    ["DÉBROUSSAILLEUSE À ESSENCE - XBC01-328", "Débroussailleuse à essence - XBC01-328"],
    ["LUNETTES DE PROTECTION ANTI UV - WORKSITE", "Lunettes de protection anti UV - Worksite"],
    ["taille-haie sans fil 1 batterie 20V 2.0ah worksite", "Taille-haie sans fil 1 batterie 20V 2.0ah Worksite"],
    ["Pied à coulisse 0-150 mm - WORKSITE", "Pied à coulisse 0-150 mm - Worksite"],
  ])("%s → %s", (raw, expected) => expect(cleanName(raw)).toBe(expected));
});

describe("brandFromName / writeDescription", () => {
  it("marque trouvée seulement dans le nom", () => {
    expect(brandFromName("Foret SDS Plus 20x200 Bosch")).toBe("Bosch");
    expect(brandFromName("Casque anti bruit")).toBeNull();
  });
  it("description rédigée à partir des caractéristiques, sans prix", () => {
    const d = writeDescription("Meuleuse 115mm", "Outillage électroportatif", ["Puissance:950 W", "Puissance:950 W", "Disque : 115 mm"]);
    expect(d).toContain("Caractéristiques :\n- Puissance : 950 W\n- Disque : 115 mm");
    expect(d).toContain("Prix et disponibilité sur demande");
  });
});
