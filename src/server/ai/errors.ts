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

const BILLING_URL = "https://platform.openai.com/settings/organization/billing";
const KEYS_URL = "https://platform.openai.com/api-keys";
const LIMITS_URL = "https://platform.openai.com/settings/organization/limits";

export const AI_MESSAGES: Record<AiErrorKind, string> = {
  not_configured: "L'IA n'est pas configurée : ajoutez la clé OPENAI_API_KEY dans le fichier .env du serveur, puis redémarrez le site.",
  malformed_key:
    "La clé OPENAI_API_KEY du .env est mal formatée (guillemets, espaces, texte d'exemple ou clé coupée) : elle n'a pas été envoyée à OpenAI. Le détail est dans Paramètres › Intelligence artificielle.",
  invalid_key: `Clé API OpenAI refusée par OpenAI (fausse, supprimée ou révoquée). Créez une nouvelle clé sur ${KEYS_URL}, remplacez OPENAI_API_KEY dans le .env du serveur, puis redémarrez le site.`,
  expired_key: `Clé API OpenAI expirée. Créez une nouvelle clé sur ${KEYS_URL}, remplacez OPENAI_API_KEY dans le .env du serveur, puis redémarrez le site.`,
  forbidden: "OpenAI refuse l'accès (pays non pris en charge ou droits insuffisants de la clé). Vérifiez les permissions de la clé sur platform.openai.com.",
  billing: `Crédit OpenAI épuisé : rechargez le compte sur ${BILLING_URL}. L'IA refonctionnera quelques minutes après le paiement.`,
  spend_limit: `Plafond de dépenses OpenAI atteint : augmentez la limite sur ${LIMITS_URL}, ou attendez le mois prochain.`,
  rate_limit: "Trop de demandes envoyées à OpenAI en peu de temps. Patientez une minute puis réessayez.",
  model: "Le modèle d'IA configuré (OPENAI_MODEL) n'existe pas ou n'est pas accessible avec cette clé. Vérifiez sa valeur dans le .env.",
  unavailable: "OpenAI est momentanément indisponible. Réessayez dans quelques minutes.",
  network: "Impossible de joindre OpenAI : vérifiez la connexion internet du serveur, puis réessayez.",
  bad_response: "La réponse de l'IA est inutilisable. Réessayez ; si cela persiste, ajoutez une photo plus nette ou plus d'informations.",
  cutout_unavailable: "Le détourage n'est pas installé sur le serveur : lancez « npm run ai:model » (téléchargement unique d'environ 170 Mo).",
  budget: "Plafond mensuel des dépenses IA du site atteint. Augmentez AI_MONTHLY_BUDGET_USD dans le .env (puis redémarrez le site), ou attendez le mois prochain.",
  no_subject: "Aucun produit net n'a été détecté sur la photo principale. Essayez avec une photo où le produit est bien visible et centré.",
};

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
