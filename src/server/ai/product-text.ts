// Service : proposer un nom et une description pour un produit (photo principale + informations).
// Sans authentification : appelé par actions.ts, qui vérifie l'admin AVANT.
// Chaque appel est enregistré dans ai_generations (suivi des coûts, décision de l'admin).
// RIEN n'est écrit sur le produit ici : l'admin relit, modifie, puis enregistre lui-même la fiche.
import "server-only";

import { prisma } from "@/lib/prisma";
import { localStorage } from "@/server/media/storage";
import { aiModel, openai } from "./client";
import { ACCOUNT_ACTION_KINDS, AiError, classifyOpenAiError } from "./errors";
import {
  buildProductTextPrompt,
  estimateCostUsd,
  parseProductTextOutput,
  PRODUCT_TEXT_INSTRUCTIONS,
  PRODUCT_TEXT_SCHEMA,
  type ProductTextHints,
  type ProductTextSuggestion,
} from "./product-text-prompt";

export type SuggestResult =
  | { ok: true; generationId: string; suggestion: ProductTextSuggestion; usedPhoto: boolean }
  | { ok: false; kind: AiError["kind"]; message: string; accountAction: boolean };

const PHOTO_WIDTH = 800; // taille déjà générée : suffisante pour lire une étiquette, peu coûteuse

export async function suggestProductText(
  productId: string,
  hints: ProductTextHints,
  adminUserId: string,
): Promise<SuggestResult> {
  const model = aiModel();
  const primary = await prisma.productImage.findFirst({
    where: { productId, position: 0 },
    select: { storageKey: true },
  });
  const photo = primary ? await localStorage.read(`${primary.storageKey}-${PHOTO_WIDTH}.webp`) : null;
  const inputImageKey = photo ? primary!.storageKey : null;
  const started = Date.now();

  try {
    const client = openai(); // lève not_configured AVANT tout enregistrement
    const response = await client.responses.create({
      model,
      instructions: PRODUCT_TEXT_INSTRUCTIONS,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: buildProductTextPrompt(hints, photo !== null) },
            ...(photo
              ? [{ type: "input_image" as const, image_url: `data:image/webp;base64,${photo.toString("base64")}`, detail: "auto" as const }]
              : []),
          ],
        },
      ],
      text: { format: { type: "json_schema", name: "fiche_produit", schema: PRODUCT_TEXT_SCHEMA, strict: true } },
      max_output_tokens: 2000,
      store: false, // OpenAI ne conserve pas la conversation
    });

    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const suggestion = response.status === "completed" ? parseProductTextOutput(response.output_text) : null;
    if (!suggestion) {
      throw new AiError("bad_response", `status=${response.status} ${response.incomplete_details?.reason ?? ""} ${response.output_text.slice(0, 200)}`);
    }

    const generation = await prisma.aiGeneration.create({
      data: {
        type: "TEXT",
        status: "PENDING",
        productId,
        adminUserId,
        inputImageKey,
        output: suggestion,
        provider: "openai",
        model,
        inputTokens,
        outputTokens,
        estimatedCostUsd: estimateCostUsd(model, inputTokens, outputTokens),
        durationMs: Date.now() - started,
      },
      select: { id: true },
    });
    return { ok: true, generationId: generation.id, suggestion, usedPhoto: photo !== null };
  } catch (error) {
    const aiError = classifyOpenAiError(error);
    if (aiError.kind !== "not_configured") {
      console.error(`[IA] Échec de la suggestion (produit ${productId}) : ${aiError.kind} ${aiError.detail ?? ""}`);
      await prisma.aiGeneration.create({
        data: {
          type: "TEXT",
          status: "FAILED",
          productId,
          adminUserId,
          inputImageKey,
          provider: "openai",
          model,
          durationMs: Date.now() - started,
          errorMessage: `${aiError.kind}: ${aiError.detail ?? ""}`.slice(0, 500),
        },
      });
    }
    return { ok: false, kind: aiError.kind, message: aiError.message, accountAction: ACCOUNT_ACTION_KINDS.includes(aiError.kind) };
  }
}

/** Décision de l'admin sur une suggestion encore en attente. */
export async function decideProductText(generationId: string, accepted: boolean): Promise<boolean> {
  const { count } = await prisma.aiGeneration.updateMany({
    where: { id: generationId, type: "TEXT", status: "PENDING" },
    data: { status: accepted ? "ACCEPTED" : "REJECTED", decidedAt: new Date() },
  });
  return count === 1;
}

/** Appel minimal pour vérifier la clé ET le crédit (une requête de quelques jetons, coût négligeable). */
export async function testAiConnection(): Promise<{ ok: true; model: string } | { ok: false; kind: AiError["kind"]; message: string; accountAction: boolean }> {
  const model = aiModel();
  try {
    await openai().responses.create({ model, input: "Réponds OK.", max_output_tokens: 16, store: false });
    return { ok: true, model };
  } catch (error) {
    const aiError = classifyOpenAiError(error);
    if (aiError.kind !== "not_configured") console.error(`[IA] Test de connexion : ${aiError.kind} ${aiError.detail ?? ""}`);
    return { ok: false, kind: aiError.kind, message: aiError.message, accountAction: ACCOUNT_ACTION_KINDS.includes(aiError.kind) };
  }
}

export type AiUsageSummary = {
  configured: boolean;
  model: string;
  monthCostUsd: number;
  monthCount: number;
  /** Dernier échec nécessitant une action, s'il est plus récent que la dernière réussite. */
  lastAccountError: { kind: AiError["kind"]; at: Date } | null;
};

export async function getAiUsageSummary(configured: boolean): Promise<AiUsageSummary> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [month, lastSuccess, lastFailure] = await Promise.all([
    prisma.aiGeneration.aggregate({
      where: { createdAt: { gte: monthStart }, status: { not: "FAILED" } },
      _sum: { estimatedCostUsd: true },
      _count: true,
    }),
    prisma.aiGeneration.findFirst({ where: { status: { not: "FAILED" } }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    // Dernier échec dû au COMPTE (crédit, clé…) : une panne réseau passagère ne doit pas le masquer.
    prisma.aiGeneration.findFirst({
      where: { status: "FAILED", OR: ACCOUNT_ACTION_KINDS.map((kind) => ({ errorMessage: { startsWith: `${kind}:` } })) },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, errorMessage: true },
    }),
  ]);
  const failedKind = lastFailure?.errorMessage?.split(":")[0] as AiError["kind"] | undefined;
  const accountError =
    lastFailure && failedKind && ACCOUNT_ACTION_KINDS.includes(failedKind) &&
    (!lastSuccess || lastFailure.createdAt > lastSuccess.createdAt)
      ? { kind: failedKind, at: lastFailure.createdAt }
      : null;
  return {
    configured,
    model: aiModel(),
    monthCostUsd: Number(month._sum.estimatedCostUsd ?? 0),
    monthCount: month._count,
    lastAccountError: accountError,
  };
}
