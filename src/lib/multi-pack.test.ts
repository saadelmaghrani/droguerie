import { describe, expect, it } from "vitest";
import { isMultiPack } from "./multi-pack";

describe("lot / pack d'après le nom", () => {
  it.each([
    "Éponge grattoir double face x10",
    "Lot de 3 pinceaux",
    "Coffret clés à pipe 8mm-32mm 19pcs",
    "Jeu de clés hexagonales, bras long",
    "Kit visseuse + boulonneuse 20V",
    "Paire de gants de travail",
    "Vis à bois (boîte de 200)",
    "Chevilles nylon 8 mm 100 pièces",
  ])("« %s » → lot", (name) => expect(isMultiPack(name)).toBe(true));

  it.each(["Pince Tolsen Tower Pincer 200 mm", "Marteau de mécanicien 400g", "Meuleuse 115mm - 950W", "Perceuse à percussion 13mm 800W", "Mètre ruban 5 m x 19 mm", "Foret SDS Plus 20x200x260mm"])(
    "« %s » → article seul",
    (name) => expect(isMultiPack(name)).toBe(false),
  );

  it("les notes de l'admin comptent aussi", () => {
    expect(isMultiPack("Pince coupante 200 mm", "vendu par lot de 6")).toBe(true);
  });
});
