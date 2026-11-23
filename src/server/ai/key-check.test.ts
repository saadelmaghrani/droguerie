import { describe, expect, it } from "vitest";
import { envFilesByPriority, inspectApiKey, keyHint, locateKeySource, readEnvValue } from "./key-check";

// Fausse clé de test (aléatoire, jamais valide).
const KEY = "sk-proj-" + "Ab3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6kM9nP2rS5uV8xY1aD4gG7jL0oR3tU6wX9zB2";

describe("inspectApiKey", () => {
  it("clé correcte → ok, indice sans la clé", () => {
    const check = inspectApiKey(`  ${KEY}\n`);
    expect(check).toEqual({ ok: true, hint: `sk-…${KEY.slice(-4)}` });
    expect(JSON.stringify(check)).not.toContain(KEY.slice(0, 20));
  });
  it.each([
    [undefined, "missing"],
    ["   ", "missing"],
    [`"${KEY}`, "quoted"],
    [`${KEY}'`, "quoted"],
    [`${KEY.slice(0, 50)} ${KEY.slice(50)}`, "whitespace"],
    [`${KEY.slice(0, 50)}\n${KEY.slice(50)}`, "whitespace"],
    ["sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", "placeholder"],
    ["change-moi", "placeholder"],
    ["<votre-clé>", "placeholder"],
    ["sk-...", "placeholder"],
    [`${KEY.slice(0, 30)}–${KEY.slice(30)}`, "invalid_chars"],
    [`pk-${KEY.slice(3)}`, "bad_prefix"],
    ["sk-proj-abc123", "too_short"],
  ] as const)("%j → %s", (raw, issue) => {
    const check = inspectApiKey(raw);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.issue).toBe(issue);
  });
  it("une vraie clé aléatoire n'est jamais prise pour un exemple", () => {
    for (const word of ["your", "todo", "xxx", "change", "key"]) {
      expect(inspectApiKey(`sk-proj-Q${word}${KEY.slice(20)}`).ok).toBe(true);
    }
  });
  it("indice : 4 derniers caractères seulement", () => {
    expect(keyHint(KEY)).toBe(`sk-…${KEY.slice(-4)}`);
  });
});

describe("readEnvValue (même lecture que dotenv)", () => {
  it.each([
    ["OPENAI_API_KEY=sk-abc", "sk-abc"],
    ['OPENAI_API_KEY="sk-abc"', "sk-abc"],
    ["OPENAI_API_KEY='sk-abc' # commentaire", "sk-abc"],
    ["export OPENAI_API_KEY=sk-abc # commentaire", "sk-abc"],
    ["OPENAI_API_KEY=", ""],
    ["# OPENAI_API_KEY=sk-abc", undefined],
    ["OPENAI_API_KEY_OLD=sk-abc", undefined],
  ])("%s → %j", (content, expected) => {
    expect(readEnvValue(content, "OPENAI_API_KEY")).toBe(expected);
  });
  it("la dernière définition l'emporte", () => {
    expect(readEnvValue("OPENAI_API_KEY=sk-1\r\nOPENAI_API_KEY=sk-2\r\n", "OPENAI_API_KEY")).toBe("sk-2");
  });
});

describe("locateKeySource", () => {
  it("ordre de priorité de Next.js", () => {
    expect(envFilesByPriority("development")).toEqual([".env.development.local", ".env.local", ".env.development", ".env"]);
    expect(envFilesByPriority("production")).toEqual([".env.production.local", ".env.local", ".env.production", ".env"]);
    expect(envFilesByPriority("test")).toEqual([".env.test.local", ".env.test", ".env"]);
  });
  it("clé lue depuis .env", () => {
    expect(locateKeySource("sk-1", { ".env": "OPENAI_API_KEY=sk-1" }, "development")).toEqual({ file: ".env", shadowed: [] });
  });
  it(".env.local prioritaire : la valeur différente du .env est signalée", () => {
    const files = { ".env": "OPENAI_API_KEY=sk-ancienne", ".env.local": "OPENAI_API_KEY=sk-1" };
    expect(locateKeySource("sk-1", files, "development")).toEqual({ file: ".env.local", shadowed: [".env"] });
  });
  it("variable exportée dans le shell : aucun fichier ne correspond", () => {
    expect(locateKeySource("sk-shell", { ".env": "OPENAI_API_KEY=sk-1" }, "development")).toEqual({ file: null, shadowed: [".env"] });
  });
  it("clé absente → null", () => {
    expect(locateKeySource(undefined, { ".env": "OPENAI_API_KEY=sk-1" }, "development")).toBeNull();
  });
});
