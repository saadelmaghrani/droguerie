import { APIConnectionError, APIError } from "openai";
import { describe, expect, it } from "vitest";
import { AI_MESSAGES, AiError, classifyOpenAiError, kindFromErrorFields, TECH_HINTS } from "./errors";
import { buildProductTextPrompt, cleanNotes, estimateCostUsd, NOTES_MAX_LENGTH, parseProductTextOutput, PRODUCT_TEXT_INSTRUCTIONS, PRODUCT_TEXT_SCHEMA, resolveCategory } from "./product-text-prompt";

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
    expect(e.message).toMatch(/n.a pas pu proposer de résultat/);
  });
  it("crédit épuisé : le message parle de recharge et propose la saisie manuelle", () => {
    expect(new AiError("billing").message).toMatch(/recharge du compte/);
    expect(new AiError("billing").message).toMatch(/manuellement/);
  });
  it("messages affichés à l'admin : aucun détail technique, toujours une solution", () => {
    for (const [kind, message] of Object.entries(AI_MESSAGES)) {
      expect(message, kind).not.toMatch(/\.env|OPENAI|AI_|npm|HTTP|\b[45]\d\d\b|serveur|clé API|api-keys|MODEL/i);
      if (kind !== "no_subject") expect(message, kind).toMatch(/manuellement|à la main/);
    }
  });
  it("la consigne technique reste disponible pour le journal du serveur", () => {
    expect(TECH_HINTS.expired_key).toMatch(/OPENAI_API_KEY/);
    expect(TECH_HINTS.cutout_unavailable).toMatch(/npm run ai:model/);
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
      category_ref: "",
      new_category: "",
      fallback_ref: "",
    });
    expect(parseProductTextOutput('{"name":"Seau","description":"d","category_ref":" C2 ","new_category":""}')?.category_ref).toBe("C2");
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

describe("catégorie proposée par l'IA", () => {
  const categories = [
    { id: "id-entretien", name: "Entretien", slug: "entretien" },
    { id: "id-peinture", name: "Peinture", slug: "peinture" },
    { id: "id-main", name: "Outillage à main", slug: "outillage-a-main" },
  ];
  const out = (category_ref: string, new_category = "") => ({ category_ref, new_category });

  it("la consigne liste TOUTES les catégories existantes avec un code", () => {
    const prompt = buildProductTextPrompt({ name: "", description: "", brand: "", reference: "", categoryName: "" }, true, categories);
    expect(prompt).toContain("Catégories existantes :\n- C1 : Entretien\n- C2 : Peinture\n- C3 : Outillage à main");
    expect(buildProductTextPrompt({ name: "", description: "", brand: "", reference: "", categoryName: "" }, true)).toContain("(aucune catégorie pour l'instant)");
  });
  it("le format de réponse impose les deux champs de catégorie", () => {
    expect(PRODUCT_TEXT_SCHEMA.required).toEqual(["name", "description", "category_ref", "new_category", "fallback_ref"]);
  });
  it("code valide → catégorie existante", () => {
    expect(resolveCategory(out("C2"), categories)).toEqual({ kind: "existing", id: "id-peinture", name: "Peinture" });
    expect(resolveCategory(out("c3"), categories)).toEqual({ kind: "existing", id: "id-main", name: "Outillage à main" });
  });
  it("code inconnu et aucun nom → null (choix manuel)", () => {
    expect(resolveCategory(out("C9"), categories)).toBeNull();
    expect(resolveCategory(out(""), categories)).toBeNull();
    expect(resolveCategory(out("", "  "), categories)).toBeNull();
  });
  it("nouveau nom équivalent à une catégorie existante → réutilisée, jamais de doublon", () => {
    expect(resolveCategory(out("", "Outils à main"), categories)).toEqual({ kind: "existing", id: "id-main", name: "Outillage à main" });
    expect(resolveCategory(out("", "Produits d'entretien"), categories)).toEqual({ kind: "existing", id: "id-entretien", name: "Entretien" });
    expect(resolveCategory(out("", "PEINTURES"), categories)).toEqual({ kind: "existing", id: "id-peinture", name: "Peinture" });
  });
  it("aucune catégorie ne correspond → nouvelle catégorie au nom propre", () => {
    expect(resolveCategory(out("", " « cadenas et serrures ». "), categories)).toEqual({ kind: "new", name: "Cadenas et serrures", alternative: null });
  });
  it("famille spécifique sans catégorie dédiée → nouvelle catégorie + catégorie large proposée en alternative", () => {
    const withHardware = [...categories, { id: "id-quinc", name: "Quincaillerie", slug: "quincaillerie" }];
    expect(resolveCategory({ category_ref: "", new_category: "Visserie", fallback_ref: "C4" }, withHardware)).toEqual({
      kind: "new",
      name: "Visserie",
      alternative: { id: "id-quinc", name: "Quincaillerie" },
    });
    // Alternative invalide : ignorée.
    expect(resolveCategory({ category_ref: "", new_category: "Visserie", fallback_ref: "C99" }, withHardware)).toEqual({ kind: "new", name: "Visserie", alternative: null });
  });
  it("famille qui a déjà sa catégorie (autre nom) → réutilisée, jamais de doublon", () => {
    const withScrews = [...categories, { id: "id-vis", name: "Visserie", slug: "visserie" }, { id: "id-colle", name: "Colles et adhésifs", slug: "colles-et-adhesifs" }];
    expect(resolveCategory({ category_ref: "", new_category: "Vis", fallback_ref: "C1" }, withScrews)).toEqual({ kind: "existing", id: "id-vis", name: "Visserie" });
    expect(resolveCategory(out("", "Colles"), withScrews)).toEqual({ kind: "existing", id: "id-colle", name: "Colles et adhésifs" });
  });
  it("la consigne explique quand créer une famille spécifique plutôt que réutiliser une catégorie large", () => {
    const prompt = PRODUCT_TEXT_INSTRUCTIONS;
    expect(prompt).toMatch(/catégorie LARGE/);
    expect(prompt).toMatch(/famille distincte et bien identifiée/);
    expect(prompt).toMatch(/« Vis » si « Visserie » existe/);
    expect(PRODUCT_TEXT_SCHEMA.required).toContain("fallback_ref");
  });
});
