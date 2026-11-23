// Nom + description d'un produit par OpenAI (lecture de la photo). Utilisé par le brouillon IA
// du nouveau produit (draft-service.ts). RIEN n'est écrit sur un produit ici.
// + test de connexion et résumé de consommation (Paramètres).
import "server-only";

import { prisma } from "@/lib/prisma";
import { aiModel, currentKeyHint, openai } from "./client";
import { ACCOUNT_ACTION_KINDS, AiError, classifyOpenAiError, logAiError } from "./errors";
import {
  buildProductTextPrompt,
  PRODUCT_TEXT_INSTRUCTIONS,
  PRODUCT_TEXT_SCHEMA,
  parseProductTextOutput,
  type ProductTextHints,
  type ProductTextSuggestion,
} from "./product-text-prompt";

/** Appel OpenAI : photo (WebP) + indices → nom et description validés. Lève AiError en cas d'échec. */
export async function generateProductText(
  photoWebp: Buffer,
  hints: ProductTextHints,
): Promise<{ suggestion: ProductTextSuggestion; model: string; inputTokens: number; outputTokens: number }> {
  const model = aiModel();
  const response = await openai().responses.create({
    model,
    instructions: PRODUCT_TEXT_INSTRUCTIONS,
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: buildProductTextPrompt(hints, true) },
          { type: "input_image", image_url: `data:image/webp;base64,${photoWebp.toString("base64")}`, detail: "auto" },
        ],
      },
    ],
    text: { format: { type: "json_schema", name: "fiche_produit", schema: PRODUCT_TEXT_SCHEMA, strict: true } },
    max_output_tokens: 2000,
    store: false, // OpenAI ne conserve pas la conversation
  });
  const suggestion = response.status === "completed" ? parseProductTextOutput(response.output_text) : null;
  if (!suggestion) {
    throw new AiError("bad_response", `status=${response.status} ${response.incomplete_details?.reason ?? ""} ${response.output_text.slice(0, 200)}`);
  }
  return { suggestion, model, inputTokens: response.usage?.input_tokens ?? 0, outputTokens: response.usage?.output_tokens ?? 0 };
}

/** Appel minimal pour vérifier la clé ET le crédit (une requête de quelques jetons, coût négligeable). */
export async function testAiConnection(): Promise<
  { ok: true } | { ok: false; kind: AiError["kind"]; message: string; accountAction: boolean }
> {
  const model = aiModel();
  const keyHint = currentKeyHint();
  try {
    await openai().responses.create({ model, input: "Réponds OK.", max_output_tokens: 16, store: false });
    console.info(`[IA] Test de connexion réussi (modèle ${model}, clé ${keyHint})`);
    return { ok: true };
  } catch (error) {
    const aiError = classifyOpenAiError(error);
    logAiError("Test de connexion", aiError, keyHint);
    return { ok: false, kind: aiError.kind, message: aiError.message, accountAction: ACCOUNT_ACTION_KINDS.includes(aiError.kind) };
  }
}

export type AiUsageSummary = {
  configured: boolean;
  model: string;
  monthCostUsd: number;
  monthCount: number;
  /** Dernier échec nécessitant une action, s'il est plus récent que la dernière réussite. */
  /** keyHint : indice « sk-…abcd » de la clé utilisée lors de l'échec (erreurs de clé uniquement). */
  lastAccountError: { kind: AiError["kind"]; at: Date; keyHint: string | null } | null;
};

export async function getAiUsageSummary(configured: boolean): Promise<AiUsageSummary> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [month, lastSuccess, lastFailure] = await Promise.all([
    prisma.aiGeneration.aggregate({
      where: { createdAt: { gte: monthStart }, status: { not: "FAILED" }, provider: "openai" },
      _sum: { estimatedCostUsd: true },
      _count: true,
    }),
    prisma.aiGeneration.findFirst({
      where: { status: { not: "FAILED" }, provider: "openai" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    // Dernier échec dû au COMPTE (crédit, clé…) : une panne réseau passagère ne doit pas le masquer.
    prisma.aiGeneration.findFirst({
      where: { status: "FAILED", OR: ACCOUNT_ACTION_KINDS.map((kind) => ({ errorMessage: { startsWith: `${kind}:` } })) },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, errorMessage: true },
    }),
  ]);
  const failedKind = lastFailure?.errorMessage?.split(":")[0] as AiError["kind"] | undefined;
  const accountError =
    lastFailure && failedKind && ACCOUNT_ACTION_KINDS.includes(failedKind) && (!lastSuccess || lastFailure.createdAt > lastSuccess.createdAt)
      ? { kind: failedKind, at: lastFailure.createdAt, keyHint: /^\w+: \[clé ([^\]]+)\]/.exec(lastFailure.errorMessage ?? "")?.[1] ?? null }
      : null;
  return {
    configured,
    model: aiModel(),
    monthCostUsd: Number(month._sum.estimatedCostUsd ?? 0),
    monthCount: month._count,
    lastAccountError: accountError,
  };
}
