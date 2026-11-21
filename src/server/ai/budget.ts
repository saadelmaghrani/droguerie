// Plafond mensuel des dépenses IA du site (AI_MONTHLY_BUDGET_USD, 10 $ par défaut).
// Protection en plus du plafond réglé sur le compte OpenAI : le site refuse lui-même de dépasser.
import "server-only";

import { prisma } from "@/lib/prisma";
import { aiMonthlyBudgetUsd } from "./client";
import { AiError } from "./errors";

/** Coûts estimés AVANT l'appel (prudents), pour ne pas dépasser le plafond. */
export const ESTIMATED_COST_USD = { text: 0.005, scene: 0.06 } as const;

export async function monthSpentUsd(): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const sum = await prisma.aiGeneration.aggregate({
    where: { createdAt: { gte: monthStart }, provider: "openai", status: { not: "FAILED" } },
    _sum: { estimatedCostUsd: true },
  });
  return Number(sum._sum.estimatedCostUsd ?? 0);
}

/** null si la dépense prévue tient dans le plafond, sinon l'erreur à afficher. */
export async function budgetError(plannedUsd: number): Promise<AiError | null> {
  const budget = aiMonthlyBudgetUsd();
  const spent = await monthSpentUsd();
  return spent + plannedUsd > budget ? new AiError("budget", `dépensé ${spent.toFixed(2)} $ + prévu ${plannedUsd.toFixed(3)} $ > plafond ${budget} $`) : null;
}
