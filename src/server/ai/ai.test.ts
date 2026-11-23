import { APIConnectionError, APIError } from "openai";
import { describe, expect, it } from "vitest";
import { AiError, classifyOpenAiError, kindFromErrorFields } from "./errors";
import { buildProductTextPrompt, cleanNotes, estimateCostUsd, NOTES_MAX_LENGTH, parseProductTextOutput } from "./product-text-prompt";

const apiError = (status: number, code?: string, type?: string) =>
  APIError.generate(status, { error: { code, type, message: "détail" } }, "détail", new Headers());

describe("classification des erreurs OpenAI", () => {
  it.each([
    [401, undefined, undefined, "invalid_key"],
    [401, "invalid_api_key", "invalid_request_error", "invalid_key"],
    [401, "expired_secret_key", undefined, "expired_key"],
    [403, undefined, undefined, "forbidden"],
    [429, "insufficient_quota", "insufficient_quota", "billing"],
    [429, "credit_balance_exhausted", undefined, "billing"],
    [429, "project_spend_limit_exceeded", undefined, "spend_limit"],
    [429, "organization_spend_limit_exceeded", undefined, "spend_limit"],
    [429, "organization_usage_limit_exceeded", undefined, "spend_limit"],
    [429, "rate_limit_exceeded", "requests", "rate_limit"],
    [429, "slow_down", "rate_limit_error", "rate_limit"],
    [404, "model_not_found", undefined, "model"],
    [500, undefined, undefined, "unavailable"],
    [503, "server_is_overloaded", "service_unavailable_error", "unavailable"],
  ] as const)("HTTP %i code=%s → %s", (status, code, type, expected) => {
    expect(kindFromErrorFields({ status, code, type })).toBe(expected);
    expect(classifyOpenAiError(apiError(status, code, type)).kind).toBe(expected);
  });

  it("erreur réseau → network", () => {
    expect(classifyOpenAiError(new APIConnectionError({ message: "ECONNREFUSED" })).kind).toBe("network");
  });
  it("erreur inconnue → bad_response, message en français", () => {
    const e = classifyOpenAiError(new Error("boom"));
    expect(e.kind).toBe("bad_response");
    expect(e.message).toMatch(/inutilisable/);
  });
  it("crédit épuisé : le message dit de recharger le compte", () => {
    expect(new AiError("billing").message).toMatch(/rechargez le compte/);
  });
});

describe("consigne", () => {
  const hints = { name: "Seau", description: "", brand: "Plastor", reference: "", categoryName: "Entretien" };
  it("liste seulement les informations renseignées", () => {
    const prompt = buildProductTextPrompt(hints, true);
    expect(prompt).toContain("- Nom actuel : Seau");
    expect(prompt).toContain("- Marque : Plastor");
    expect(prompt).not.toContain("Référence");
    expect(prompt).toContain("photo du produit");
  });
  it("ajoute les indications du magasin, délimitées", () => {
    const prompt = buildProductTextPrompt({ ...hints, notes: "  Plastique alimentaire,\tanse renforcée " }, true);
    expect(prompt).toContain('Indications du magasin (faits fiables à utiliser en priorité) :\n"""Plastique alimentaire, anse renforcée"""');
  });
  it("sans indications : aucun bloc ajouté", () => {
    expect(buildProductTextPrompt({ ...hints, notes: "   " }, true)).not.toContain("Indications du magasin");
  });
  it("nettoie les indications (contrôles, délimiteurs, longueur)", () => {
    expect(cleanNotes('a\u0007b """c"""')).toBe('a b ""c""');
    expect(cleanNotes("x".repeat(900))).toHaveLength(NOTES_MAX_LENGTH);
  });
  it("sans photo, le dit explicitement", () => {
    expect(buildProductTextPrompt(hints, false)).toContain("Aucune photo");
  });
});

describe("lecture de la réponse", () => {
  it("JSON valide", () => {
    expect(parseProductTextOutput('{"name":" Seau 10 L ","description":"Seau robuste."}')).toEqual({
      name: "Seau 10 L",
      description: "Seau robuste.",
    });
  });
  it("JSON invalide, nom trop long ou vide → null", () => {
    expect(parseProductTextOutput("pas du json")).toBeNull();
    expect(parseProductTextOutput(JSON.stringify({ name: "x".repeat(121), description: "d" }))).toBeNull();
    expect(parseProductTextOutput(JSON.stringify({ name: "", description: "d" }))).toBeNull();
  });
});

describe("coût estimé", () => {
  it("calcule à partir des jetons", () => {
    expect(estimateCostUsd("gpt-6.2-sol", 1_000_000, 100_000)).toBe(3);
  });
  it("modèle inconnu → 0", () => {
    expect(estimateCostUsd("autre-modele", 1000, 1000)).toBe(0);
  });
});
