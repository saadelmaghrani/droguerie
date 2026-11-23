// Erreurs OpenAI → message clair pour l'administrateur, avec l'action à faire.
// Sans "server-only" : logique pure, testée par errors.test.ts.
// Codes documentés : https://developers.openai.com/api/docs/guides/error-codes
import { APIConnectionError, APIError } from "openai";

export type AiErrorKind =
  | "not_configured" // clé absente du .env
  | "malformed_key" // clé présente mais mal formatée (guillemets, espaces…) : jamais envoyée à OpenAI
  | "invalid_key" // 401 : clé fausse, supprimée ou révoquée
  | "expired_key" // 401 « expired_secret_key » : clé expirée
  | "forbidden" // 403 : pays non pris en charge, droits de la clé
  | "billing" // 429 : crédit épuisé → recharger le compte
  | "spend_limit" // 429 : plafond de dépenses atteint → relever la limite
  | "rate_limit" // 429 : trop de demandes → réessayer plus tard
  | "model" // modèle inconnu ou non autorisé (OPENAI_MODEL)
  | "unavailable" // 5xx : OpenAI indisponible
  | "network" // le serveur n'arrive pas à joindre OpenAI
  | "bad_response" // réponse inutilisable (refus, coupée, JSON invalide)
  | "cutout_unavailable" // modèle de détourage non installé sur le serveur
  | "no_subject" // aucun produit net détecté sur la photo
  | "budget"; // plafond mensuel du site atteint (AI_MONTHLY_BUDGET_USD)

const MANUAL = "Vous pouvez remplir la fiche manuellement.";
const UNAVAILABLE = `L'assistant IA n'est pas disponible pour le moment. ${MANUAL} Si cela dure, contactez votre prestataire.`;

/**
 * Messages AFFICHÉS dans l'admin : langage simple pour le commerçant, toujours une solution manuelle.
 * Aucun détail technique (fichier de configuration, nom de variable, code HTTP, commande) :
 * ceux-ci sont dans TECH_HINTS, écrits uniquement dans le journal du serveur (logAiError).
 */
export const AI_MESSAGES: Record<AiErrorKind, string> = {
  not_configured: UNAVAILABLE,
  malformed_key: UNAVAILABLE,
  invalid_key: UNAVAILABLE,
  expired_key: UNAVAILABLE,
  forbidden: UNAVAILABLE,
  model: UNAVAILABLE,
  cutout_unavailable: UNAVAILABLE,
  billing: `Le crédit de l'assistant IA est épuisé. ${MANUAL} L'IA refonctionnera après la recharge du compte (contactez votre prestataire si besoin).`,
  spend_limit: `La limite de dépenses de l'assistant IA est atteinte. ${MANUAL} L'IA refonctionnera le mois prochain ou après relèvement de la limite.`,
  budget: `Le plafond mensuel de l'assistant IA est atteint. ${MANUAL} L'IA sera de nouveau disponible le mois prochain.`,
  rate_limit: `L'assistant IA est très sollicité. Patientez une minute puis réessayez, ou remplissez la fiche manuellement.`,
  unavailable: `Service IA temporairement indisponible. Veuillez réessayer dans quelques minutes ou remplir la fiche manuellement.`,
  network: `Service IA temporairement injoignable. Veuillez réessayer dans quelques minutes ou remplir la fiche manuellement.`,
  bad_response: `L'IA n'a pas pu proposer de résultat cette fois-ci. Réessayez, ou remplissez la fiche manuellement.`,
  no_subject: "Aucun produit net n'a été détecté sur la photo principale. Essayez avec une photo où le produit est bien visible et centré.",
};

const KEYS_URL = "https://platform.openai.com/api-keys";
const RESTART = "puis recharger la config (npm run dev : automatique ; production : redémarrer le site)";

/** Consigne technique pour le développeur / prestataire — JOURNAL SERVEUR UNIQUEMENT, jamais affichée. */
export const TECH_HINTS: Record<AiErrorKind, string> = {
  not_configured: `OPENAI_API_KEY absente : l'ajouter dans le .env du serveur, ${RESTART}`,
  malformed_key: `OPENAI_API_KEY mal formatée (guillemets, espaces, exemple, coupée) — non envoyée à OpenAI : la corriger dans le .env, ${RESTART}`,
  invalid_key: `HTTP 401 clé refusée (fausse/supprimée/révoquée) : nouvelle clé sur ${KEYS_URL}, remplacer OPENAI_API_KEY dans le .env, ${RESTART}`,
  expired_key: `HTTP 401 expired_secret_key : nouvelle clé sur ${KEYS_URL}, remplacer OPENAI_API_KEY dans le .env, ${RESTART}`,
  forbidden: "HTTP 403 : pays non pris en charge ou permissions insuffisantes de la clé (platform.openai.com)",
  billing: "HTTP 429 insufficient_quota : recharger le crédit (platform.openai.com › Billing)",
  spend_limit: "HTTP 429 *_spend_limit_exceeded : relever la limite (platform.openai.com › Limits)",
  rate_limit: "HTTP 429 rate limit : trop de requêtes, réessayer",
  model: "OPENAI_MODEL / OPENAI_IMAGE_MODEL inconnu ou non autorisé pour cette clé : vérifier le .env",
  unavailable: "HTTP 5xx : panne OpenAI (status.openai.com)",
  network: "Connexion à l'API OpenAI impossible depuis le serveur (DNS, pare-feu, internet)",
  bad_response: "Réponse OpenAI inutilisable (refus, coupée, JSON invalide) ou traitement d'image échoué",
  cutout_unavailable: "Modèle de détourage absent : lancer « npm run ai:model » sur le serveur (MODELS_DIR)",
  budget: "Plafond du site atteint : AI_MONTHLY_BUDGET_USD dans le .env",
  no_subject: "Détourage : aucun sujet net détecté",
};

/** Écrit l'erreur complète (type, consigne, détail OpenAI, indice de clé) dans le journal du serveur. */
export function logAiError(context: string, error: AiError, keyHint?: string | null): void {
  const parts = [`[IA] ${context} : ${error.kind}`, TECH_HINTS[error.kind], error.detail, keyHint ? `clé ${keyHint}` : null];
  console.error(parts.filter(Boolean).join(" — "));
}

/** L'administrateur doit agir sur son compte OpenAI (bandeau d'alerte, pas une simple erreur passagère). */
/** Erreurs liées à la clé elle-même (à corriger dans le .env). */
export const KEY_ERROR_KINDS: AiErrorKind[] = ["not_configured", "malformed_key", "invalid_key", "expired_key"];

export const ACCOUNT_ACTION_KINDS: AiErrorKind[] = ["not_configured", "malformed_key", "invalid_key", "expired_key", "forbidden", "billing", "spend_limit", "model", "budget"];

export class AiError extends Error {
  constructor(
    readonly kind: AiErrorKind,
    /** Détail technique (journal / historique), jamais montré tel quel. */
    readonly detail?: string,
  ) {
    super(AI_MESSAGES[kind]);
    this.name = "AiError";
  }
}

type ErrorLike = { status?: number; code?: string | null; type?: string; message?: string };

function kindFromApiError({ status, code, type }: ErrorLike): AiErrorKind {
  const c = code ?? "";
  if (status === 401) return c.includes("expired") ? "expired_key" : "invalid_key";
  if (status === 403) return "forbidden";
  if (status === 404 || c === "model_not_found") return "model";
  if (status === 429) {
    if (c === "insufficient_quota" || c === "credit_balance_exhausted" || type === "insufficient_quota") return "billing";
    if (c.endsWith("_spend_limit_exceeded") || c.endsWith("_usage_limit_exceeded")) return "spend_limit";
    return "rate_limit";
  }
  if (status === 400 && (c.includes("model") || /model/i.test(type ?? ""))) return "model";
  if (status !== undefined && status >= 500) return "unavailable";
  return "bad_response";
}

export function classifyOpenAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  // Ordre important : APIConnectionError hérite de APIError.
  if (error instanceof APIConnectionError) return new AiError("network", error.message);
  if (error instanceof APIError) {
    const detail = [error.status, error.code, error.message].filter(Boolean).join(" · ");
    return new AiError(kindFromApiError(error), detail);
  }
  return new AiError("bad_response", error instanceof Error ? error.message : String(error));
}

/** Exporté pour les tests : classification à partir des seuls champs status / code / type. */
export const kindFromErrorFields = kindFromApiError;
