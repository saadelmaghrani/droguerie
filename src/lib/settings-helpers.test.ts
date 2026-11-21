import { describe, expect, it } from "vitest";
import { contrastRatio, isHexColor, readableTextColor } from "./color";
import { parseMapsEmbed, parseSocialUrl } from "./external-links";

describe("couleurs", () => {
  it("valide le format #RRGGBB", () => {
    expect(isHexColor("#334155")).toBe(true);
    expect(isHexColor("#ABCDEF")).toBe(true);
    for (const bad of ["334155", "#fff", "#12345g", "rouge", "#1234567", ""]) expect(isHexColor(bad)).toBe(false);
  });
  it("contraste : noir/blanc = 21, identique = 1", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#334155", "#334155")).toBeCloseTo(1, 5);
  });
  it.each([
    ["#334155", "#ffffff"], // ardoise foncée → texte blanc
    ["#0f766e", "#ffffff"], // vert foncé
    ["#facc15", "#0f172a"], // jaune → texte foncé
    ["#ffffff", "#0f172a"],
    ["#f97316", "#0f172a"], // orange vif → texte foncé plus lisible
  ])("fond %s → texte %s", (bg, fg) => {
    expect(readableTextColor(bg)).toBe(fg);
  });
  it("le texte choisi atteint toujours au moins 4,5:1 sur des couleurs courantes", () => {
    for (const bg of ["#334155", "#dc2626", "#16a34a", "#2563eb", "#facc15", "#7c3aed", "#0891b2", "#ea580c"]) {
      expect(contrastRatio(bg, readableTextColor(bg))).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("parseMapsEmbed", () => {
  const embed = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3323";
  it("accepte l'URL d'intégration", () => {
    expect(parseMapsEmbed(embed)).toEqual({ ok: true, value: embed });
  });
  it("extrait l'adresse d'un code <iframe> complet (&amp; décodé)", () => {
    const iframe = `<iframe src="https://www.google.com/maps/embed?pb=!1m18&amp;hl=fr" width="600" height="450" style="border:0;" allowfullscreen="" loading="lazy"></iframe>`;
    expect(parseMapsEmbed(iframe)).toEqual({ ok: true, value: "https://www.google.com/maps/embed?pb=!1m18&hl=fr" });
  });
  it.each([
    ["lien de partage classique", "https://maps.app.goo.gl/abc123"],
    ["autre site", "https://evil.example.com/maps/embed?pb=1"],
    ["domaine imitant Google", "https://www.google.com.evil.com/maps/embed?pb=1"],
    ["http non sécurisé", "http://www.google.com/maps/embed?pb=1"],
    ["javascript:", "javascript:alert(1)"],
    ["iframe vers un autre site", `<iframe src="https://evil.com/x"></iframe>`],
    ["iframe sans src", `<iframe onload="alert(1)"></iframe>`],
    ["page Google Maps non intégrable", "https://www.google.com/maps/place/Casablanca"],
    ["texte quelconque", "Casablanca centre"],
  ])("refuse : %s", (_label, input) => {
    expect(parseMapsEmbed(input).ok).toBe(false);
  });
});

describe("parseSocialUrl", () => {
  it.each([
    ["facebook", "https://www.facebook.com/ma.droguerie", "https://www.facebook.com/ma.droguerie"],
    ["facebook", "facebook.com/ma.droguerie", "https://facebook.com/ma.droguerie"],
    ["facebook", "http://m.facebook.com/ma.droguerie", "https://m.facebook.com/ma.droguerie"],
    ["instagram", "https://instagram.com/ma_droguerie", "https://instagram.com/ma_droguerie"],
    ["tiktok", "https://www.tiktok.com/@ma_droguerie", "https://www.tiktok.com/@ma_droguerie"],
  ] as const)("%s : « %s » accepté", (network, input, expected) => {
    expect(parseSocialUrl(network, input)).toEqual({ ok: true, value: expected });
  });
  it.each([
    ["facebook", "https://instagram.com/x"], // mauvais réseau
    ["facebook", "https://facebook.com.evil.com/x"],
    ["facebook", "https://evilfacebook.com/x"],
    ["facebook", "https://facebook.com/"], // pas de page
    ["instagram", "javascript:alert(1)"],
    ["tiktok", "https://user:pass@tiktok.com/@x"],
    ["instagram", "ma droguerie"],
  ] as const)("%s : « %s » refusé", (network, input) => {
    expect(parseSocialUrl(network, input).ok).toBe(false);
  });
});
