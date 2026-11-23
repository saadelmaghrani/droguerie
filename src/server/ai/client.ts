// Configuration et client OpenAI. Côté SERVEUR uniquement : "server-only" fait échouer la
// compilation si ce fichier est importé par un composant navigateur. La clé n'est lue que dans
// process.env (jamais préfixée NEXT_PUBLIC_, donc jamais envoyée au navigateur).
import "server-only";

import OpenAI from "openai";
import { AiError } from "./errors";
import { inspectApiKey, keyHint } from "./key-check";

/** Modèle par défaut : le plus économique, lit les photos (≈ 0,001 $ par fiche). Modifiable via OPENAI_MODEL. */
export const DEFAULT_OPENAI_MODEL = "gpt-6-luna";

/** Plafond mensuel des dépenses IA DU SITE, en dollars (en plus du plafond du compte OpenAI). */
export function aiMonthlyBudgetUsd(): number {
  const value = Number.parseFloat(process.env.AI_MONTHLY_BUDGET_USD ?? "");
  return Number.isFinite(value) && value >= 0 ? value : 10;
}

export function aiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

/**
 * Interrupteur général de l'IA (bouton « Générer avec l'IA » de la page Nouveau produit).
 * En pause par défaut : AI_ENABLED=true dans le .env pour l'activer. Le reste du site n'en dépend pas.
 */
export function isAiFeatureEnabled(): boolean {
  return process.env.AI_ENABLED?.trim().toLowerCase() === "true";
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** « sk-…abcd » de la clé lue en ce moment (null si absente) : pour savoir QUELLE clé a échoué. */
export function currentKeyHint(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  return key ? keyHint(key) : null;
}

let client: OpenAI | null = null;
let clientKey: string | null = null;

/**
 * Client OpenAI. Lève AiError("not_configured") si la clé est absente, AiError("malformed_key") si elle
 * est visiblement mal recopiée (rien n'est alors envoyé à OpenAI). La clé est relue à chaque appel :
 * si elle change (rechargement du .env), un nouveau client est créé — aucune ancienne clé en cache.
 */
export function openai(): OpenAI {
  const check = inspectApiKey(process.env.OPENAI_API_KEY);
  if (!check.ok) throw new AiError(check.issue === "missing" ? "not_configured" : "malformed_key", check.issue);
  const apiKey = process.env.OPENAI_API_KEY!.trim();
  if (!client || clientKey !== apiKey) {
    client = new OpenAI({
      apiKey,
      timeout: 60_000,
      // Le SDK réessaie déjà les erreurs passagères (429 de débit, 5xx). Une seule nouvelle tentative :
      // réessayer un crédit épuisé ne sert à rien et ralentirait le message d'erreur.
      maxRetries: 1,
    });
    clientKey = apiKey;
  }
  return client;
}
