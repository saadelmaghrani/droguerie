import { existsSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { enforceWhiteBackground, scenePrompt, whitenNearWhite } from "./scenes-openai";
import { cutoutModelPath } from "./studio-cutout";

describe("photos « Générées par l'IA » : fond blanc par défaut", () => {
  it.each([0, 1] as const)("prompt %s (blanc) : #FFFFFF, centré, net, sans décor", (index) => {
    const prompt = scenePrompt(index, "white");
    expect(prompt).toContain("#FFFFFF");
    expect(prompt).toMatch(/centered/);
    expect(prompt).toMatch(/sharp focus/);
    expect(prompt).toMatch(/No workshop, no table or floor surface/);
    expect(prompt).not.toMatch(/wooden tabletop|gradient backdrop/);
    expect(prompt).toMatch(/STRICT RULES/); // le produit ne doit jamais être modifié
  });

  it("décor seulement sur choix explicite « scene »", () => {
    expect(scenePrompt(0, "scene")).toMatch(/wooden tabletop/);
  });

  it("quasi-blanc → blanc pur, le produit (couleurs) inchangé", async () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#f6f6f4"/><rect x="30" y="30" width="40" height="40" fill="#d62828"/></svg>`;
    const out = await sharp(await whitenNearWhite(await sharp(Buffer.from(svg)).png().toBuffer())).raw().toBuffer({ resolveWithObject: true });
    expect([...out.data.subarray(0, 3)]).toEqual([255, 255, 255]);
    const center = (50 * 100 + 50) * 3;
    expect([...out.data.subarray(center, center + 3)]).toEqual([214, 40, 40]);
  });
});

describe.skipIf(!existsSync(cutoutModelPath()))("garantie après génération (détourage local)", () => {
  it("image IA « presque blanche » et décentrée → carré #FFFFFF, produit centré", async () => {
    // Ce que renvoie souvent un générateur : fond #F4F4F2 avec voile gris, produit décalé vers la droite.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024">
      <defs><radialGradient id="v" cx="0.5" cy="0.5" r="0.8"><stop offset="0" stop-color="#f7f7f5"/><stop offset="1" stop-color="#e4e4e2"/></radialGradient></defs>
      <rect width="1024" height="1024" fill="url(#v)"/>
      <rect x="560" y="250" width="260" height="520" rx="30" fill="#2563eb"/>
      <rect x="590" y="420" width="200" height="160" fill="#fff"/>
      <text x="690" y="515" font-size="44" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#b91c1c">JAVEL</text>
    </svg>`;
    const out = await sharp(await enforceWhiteBackground(await sharp(Buffer.from(svg)).png().toBuffer())).raw().toBuffer({ resolveWithObject: true });
    const side = out.info.width;
    expect(out.info.height).toBe(side);
    for (const [x, y] of [[0, 0], [side - 1, 0], [0, side - 1], [side - 1, side - 1], [5, Math.round(side / 2)]]) {
      const i = (y! * side + x!) * out.info.channels;
      expect([...out.data.subarray(i, i + 3)]).toEqual([255, 255, 255]);
    }
    // Produit (bleu) centré horizontalement : premières / dernières colonnes bleues symétriques.
    const row = Math.round(side / 2);
    const blue = (x: number) => {
      const i = (row * side + x) * out.info.channels;
      return out.data[i + 2]! > 180 && out.data[i]! < 90;
    };
    let first = 0;
    while (first < side && !blue(first)) first++;
    let last = side - 1;
    while (last > 0 && !blue(last)) last--;
    expect(Math.abs(first - (side - 1 - last))).toBeLessThan(side * 0.02);
  });
});
