// Configuration et client OpenAI. Côté SERVEUR uniquement : "server-only" fait échouer la
// compilation si ce fichier est importé par un composant navigateur. La clé n'est lue que dans
// process.env (jamais préfixée NEXT_PUBLIC_, donc jamais envoyée au navigateur).
import "server-only";

import OpenAI from "openai";
import { AiError } from "./errors";

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

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

let client: OpenAI | null = null;
let clientKey: string | null = null;

/** Client OpenAI ; lève AiError("not_configured") si la clé est absente. */
export function openai(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new AiError("not_configured");
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
