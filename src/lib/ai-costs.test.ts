import { describe, expect, it } from "vitest";
import { estimateGenerationUsd, formatUsd } from "./ai-costs";

describe("estimateGenerationUsd", () => {
  it("montages locaux : seul le texte est payant", () => {
    expect(estimateGenerationUsd({ extraCount: 2, extraKind: "montage", openAiConfigured: true })).toBeCloseTo(0.001);
  });
  it("mises en scène IA : texte + 0,05 $ par photo", () => {
    expect(estimateGenerationUsd({ extraCount: 0, extraKind: "ai", openAiConfigured: true })).toBeCloseTo(0.001);
    expect(estimateGenerationUsd({ extraCount: 1, extraKind: "ai", openAiConfigured: true })).toBeCloseTo(0.051);
    expect(estimateGenerationUsd({ extraCount: 2, extraKind: "ai", openAiConfigured: true })).toBeCloseTo(0.101);
  });
  it("sans OpenAI : gratuit (photos locales uniquement)", () => {
    expect(estimateGenerationUsd({ extraCount: 2, extraKind: "ai", openAiConfigured: false })).toBe(0);
  });
});

describe("formatUsd", () => {
  it("affichage lisible", () => {
    expect(formatUsd(0)).toBe("gratuit");
    expect(formatUsd(0.001)).toBe("≈ 0,001 $");
    expect(formatUsd(0.101)).toBe("≈ 0,10 $");
  });
});
