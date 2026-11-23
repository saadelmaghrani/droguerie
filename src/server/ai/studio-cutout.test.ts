// Test d'intégration du détourage : nécessite le modèle (npm run ai:model), sinon ignoré.
import { existsSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { alphaBounds, composeMontage, composeWhite, MIN_STUDIO_SIDE, cutoutMask, cutoutModelPath, cutoutProduct, FILL_RATIO, MAX_UNCERTAIN_RATIO, montageLayout, refineAlpha, STUDIO_BACKGROUND, straightenAngle, studioFromCutout, uncertainRatio } from "./studio-cutout";

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

  it.each(["studio", "table"] as const)("montage « %s » : produit posé à l'identique sur le décor", async (style) => {
    const photo = await fakeProductPhoto();
    const cut = await cutoutProduct(photo);
    const product = await sharp(cut.png).raw().toBuffer({ resolveWithObject: true }); // RGBA, pixels d'origine
    const montage = await sharp(await composeMontage(cut, style)).raw().toBuffer({ resolveWithObject: true });
    const { side, left, top } = montageLayout(cut, style);
    expect(montage.info.width).toBe(side);
    let compared = 0;
    let different = 0;
    for (let y = 0; y < cut.height; y++) {
      for (let x = 0; x < cut.width; x++) {
        const i = (y * cut.width + x) * 4;
        if (product.data[i + 3] !== 255) continue; // bords fondus : non comparés
        compared++;
        const j = ((top + y) * side + (left + x)) * montage.info.channels;
        if (product.data[i] !== montage.data[j] || product.data[i + 1] !== montage.data[j + 1] || product.data[i + 2] !== montage.data[j + 2]) different++;
      }
    }
    expect(compared).toBeGreaterThan(100_000);
    expect(different).toBe(0);
  });

  it("refuse une photo sans produit (image unie)", async () => {
    const blank = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#cccccc" } }).png().toBuffer();
    await expect(studioFromCutout(blank)).rejects.toMatchObject({ kind: "no_subject" });
  });
});

/** Masque d'un rectangle w×h tourné de `deg` degrés (sens horaire, y vers le bas), centré. */
function rotatedRect(size: number, w: number, h: number, deg: number): Buffer {
  const mask = Buffer.alloc(size * size);
  const a = (deg * Math.PI) / 180;
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      const u = dx * Math.cos(a) + dy * Math.sin(a);
      const v = -dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(u) <= w / 2 && Math.abs(v) <= h / 2) mask[y * size + x] = 255;
    }
  }
  return mask;
}

describe("redressement automatique (axe principal de la silhouette)", () => {
  it.each([10, -8, 4])("objet allongé penché de %s° → angle détecté", (deg) => {
    expect(straightenAngle(rotatedRect(400, 330, 70, deg), 400, 400)).toBeCloseTo(deg, 0);
  });

  it("objet vertical penché (axe proche de 90°) → écart à la verticale", () => {
    expect(straightenAngle(rotatedRect(400, 70, 330, 10), 400, 400)).toBeCloseTo(10, 0);
  });

  it("ne touche pas : déjà droit, forme trapue (meuleuse…), ou posé en diagonale exprès (> 12°)", () => {
    expect(straightenAngle(rotatedRect(400, 330, 70, 1), 400, 400)).toBe(0);
    expect(straightenAngle(rotatedRect(400, 240, 110, 8), 400, 400)).toBe(0);
    expect(straightenAngle(rotatedRect(400, 330, 60, 25), 400, 400)).toBe(0);
  });

  it("contour incertain (visuel publicitaire) → refusé au-delà de 35 %", () => {
    expect(uncertainRatio(Buffer.from([0, 0, 255, 255, 255, 120]))).toBeCloseTo(0.25, 2);
    expect(uncertainRatio(Buffer.from([0, 100, 120, 255]))).toBeGreaterThan(MAX_UNCERTAIN_RATIO);
  });
});

describe.skipIf(!existsSync(cutoutModelPath()))("photo studio : produit penché sur un établi", () => {
  it("redresse, centre sur un carré blanc avec ~12 % de marge", async () => {
    // Clé plate grise penchée de 9° sur un plan de travail en bois (photo « prise à la va-vite »).
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="800">
      <rect width="1000" height="800" fill="#a0784f"/>
      <g stroke="#8a6440" stroke-width="6">${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="${i * 70}" x2="1000" y2="${i * 70 + 30}"/>`).join("")}</g>
      <g transform="rotate(9 500 400)">
        <rect x="200" y="350" width="600" height="100" rx="20" fill="#d1d5db" stroke="#374151" stroke-width="8"/>
        <text x="500" y="415" font-size="48" font-family="Arial" font-weight="bold" text-anchor="middle" fill="#1f2937">TOTAL 24mm</text>
      </g>
    </svg>`;
    const photo = await sharp(Buffer.from(svg)).png().toBuffer();
    const cut = await cutoutProduct(photo);
    // Redressé : nettement plus large que haut (penchée, sa boîte serait ~ 610 × 190).
    expect(cut.width / cut.height).toBeGreaterThan(4.6);

    const out = await sharp(await studioFromCutout(photo)).raw().toBuffer({ resolveWithObject: true });
    const side = out.info.width;
    expect(out.info.height).toBe(side);
    // Fond blanc pur aux 4 coins.
    for (const [x, y] of [[0, 0], [side - 1, 0], [0, side - 1], [side - 1, side - 1]]) {
      const i = (y! * side + x!) * out.info.channels;
      expect([...out.data.subarray(i, i + 3)]).toEqual([255, 255, 255]);
    }
    // Marge latérale ≈ 12 % (le produit, plus large que haut, touche la largeur maximale).
    const margin = (side - cut.width) / 2 / side;
    expect(margin).toBeCloseTo((1 - FILL_RATIO) / 2, 2);
  });
});

describe("cadrage studio", () => {
  it("petit produit agrandi : occupe toujours 76 % d'un carré d'au moins 600 px", async () => {
    const png = await sharp({ create: { width: 120, height: 60, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } }).png().toBuffer();
    const out = await sharp(await composeWhite({ png, width: 120, height: 60 })).raw().toBuffer({ resolveWithObject: true });
    expect(out.info.width).toBe(MIN_STUDIO_SIDE);
    expect(out.info.height).toBe(MIN_STUDIO_SIDE);
    // Ligne du milieu : premier pixel rouge à ~12 % du bord gauche.
    const y = Math.round(MIN_STUDIO_SIDE / 2);
    let first = -1;
    for (let x = 0; x < MIN_STUDIO_SIDE; x++) {
      const i = (y * MIN_STUDIO_SIDE + x) * out.info.channels;
      if (out.data[i]! > 150 && out.data[i + 1]! < 80) { first = x; break; }
    }
    expect(first / MIN_STUDIO_SIDE).toBeCloseTo((1 - FILL_RATIO) / 2, 2);
  });
});
