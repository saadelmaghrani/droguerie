import { describe, expect, it } from "vitest";
import { activePixelId, parsePixelId } from "./meta-pixel";

describe("Meta Pixel", () => {
  it("accepte un identifiant numérique (espaces retirés)", () => {
    expect(parsePixelId("123456789012345")).toEqual({ ok: true, value: "123456789012345" });
    expect(parsePixelId(" 1234 5678 9012 345 ")).toEqual({ ok: true, value: "123456789012345" });
  });

  it("vide = pas de Pixel, sans erreur", () => {
    expect(parsePixelId("")).toEqual({ ok: true, value: null });
    expect(parsePixelId(null)).toEqual({ ok: true, value: null });
  });

  it("refuse lettres, code collé ou longueur anormale", () => {
    for (const bad of ["abc", "12345", "fbq('init', '123456789012345')", "123456789012345678901", "<script>"]) {
      expect(parsePixelId(bad).ok).toBe(false);
    }
  });

  it("chargé seulement si activé ET valide", () => {
    expect(activePixelId(true, "123456789012345")).toBe("123456789012345");
    expect(activePixelId(false, "123456789012345")).toBeNull();
    expect(activePixelId(true, "")).toBeNull();
    expect(activePixelId(true, "pas-un-id")).toBeNull();
  });
});
