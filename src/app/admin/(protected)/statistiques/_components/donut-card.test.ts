import { describe, expect, it } from "vitest";
import { CATEGORICAL, foldSlices } from "./donut-card";

describe("foldSlices", () => {
  it("garde 4 parts au maximum, triées, couleurs dans l'ordre fixe", () => {
    const parts = foldSlices([
      { label: "a", value: 5 }, { label: "b", value: 50 }, { label: "c", value: 20 }, { label: "d", value: 10 },
    ]);
    expect(parts.map((p) => p.label)).toEqual(["b", "c", "d", "a"]);
    expect(parts.map((p) => p.color)).toEqual([...CATEGORICAL]);
  });
  it("au-delà de 4 : 3 premières + « Autres » (somme du reste)", () => {
    const parts = foldSlices([1, 2, 3, 4, 5, 6].map((v) => ({ label: `s${v}`, value: v })));
    expect(parts.map((p) => [p.label, p.value])).toEqual([["s6", 6], ["s5", 5], ["s4", 4], ["Autres", 6]]);
  });
  it("ignore les parts nulles", () => {
    expect(foldSlices([{ label: "a", value: 0 }, { label: "b", value: 3 }])).toHaveLength(1);
  });
});
