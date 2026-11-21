// Test d'intégration du détourage : nécessite le modèle (npm run ai:model), sinon ignoré.
import { existsSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { alphaBounds, cutoutMask, cutoutModelPath, refineAlpha, STUDIO_BACKGROUND, studioFromCutout } from "./studio-cutout";

// Photo « amateur » synthétique : produit (flacon bleu + étiquette avec texte) sur un fond beige dégradé.
async function fakeProductPhoto(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cdbb9e"/><stop offset="1" stop-color="#8f7d63"/></linearGradient></defs>
    <rect width="900" height="900" fill="url(#g)"/>
    <rect x="390" y="150" width="120" height="90" rx="10" fill="#1d4ed8"/>
    <rect x="300" y="230" width="300" height="520" rx="40" fill="#2563eb"/>
    <rect x="320" y="380" width="260" height="200" fill="#ffffff"/>
    <text x="450" y="470" font-size="56" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#b91c1c">JAVEL</text>
    <text x="450" y="540" font-size="36" font-family="Arial" text-anchor="middle" fill="#111">5 L</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe.skipIf(!existsSync(cutoutModelPath()))("détourage fond studio", () => {
  it("détecte le produit et laisse ses pixels STRICTEMENT identiques", async () => {
    const photo = await fakeProductPhoto();
    const { data: rgb, info } = await sharp(photo).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const alpha = refineAlpha(await cutoutMask(rgb, info.width, info.height));
    const box = alphaBounds(alpha, info.width, info.height)!;
    expect(box).not.toBeNull();
    // Le produit (x 300–600, y 150–750) est trouvé, à quelques pixels près.
    expect(Math.abs(box.left - 300)).toBeLessThan(15);
    expect(Math.abs(box.top - 150)).toBeLessThan(15);
    expect(Math.abs(box.left + box.width - 600)).toBeLessThan(15);
    expect(Math.abs(box.top + box.height - 750)).toBeLessThan(15);

    const result = await studioFromCutout(photo);
    const out = await sharp(result).raw().toBuffer({ resolveWithObject: true });
    const side = out.info.width;
    expect(out.info.height).toBe(side); // image carrée
    const offX = Math.round((side - box.width) / 2) - box.left;
    const offY = Math.round((side - box.height) / 2) - box.top;

    // Chaque pixel opaque du produit (dont l'étiquette « JAVEL 5 L ») est recopié à l'identique.
    let compared = 0;
    let different = 0;
    for (let y = box.top; y < box.top + box.height; y++) {
      for (let x = box.left; x < box.left + box.width; x++) {
        if (alpha[y * info.width + x] !== 255) continue;
        compared++;
        const i = (y * info.width + x) * 3;
        const j = ((y + offY) * side + (x + offX)) * out.info.channels;
        if (rgb[i] !== out.data[j] || rgb[i + 1] !== out.data[j + 1] || rgb[i + 2] !== out.data[j + 2]) different++;
      }
    }
    expect(compared).toBeGreaterThan(100_000);
    expect(different).toBe(0);

    // Coin = fond studio uniforme (l'ancien fond beige a disparu).
    expect([...out.data.subarray(0, 3)]).toEqual([STUDIO_BACKGROUND.r, STUDIO_BACKGROUND.g, STUDIO_BACKGROUND.b]);
  });

  it("refuse une photo sans produit (image unie)", async () => {
    const blank = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#cccccc" } }).png().toBuffer();
    await expect(studioFromCutout(blank)).rejects.toMatchObject({ kind: "no_subject" });
  });
});
