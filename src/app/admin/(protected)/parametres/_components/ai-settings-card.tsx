// Encadré « Intelligence artificielle » des Paramètres : état de la clé OpenAI, consommation du mois,
// dernière erreur de compte (crédit épuisé…) et bouton de test. Composant serveur.
import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { aiModel, aiMonthlyBudgetUsd, isAiConfigured, isAiFeatureEnabled } from "@/server/ai/client";
import { AI_MESSAGES } from "@/server/ai/errors";
import { getAiUsageSummary } from "@/server/ai/product-text";
import { AiTestButton } from "./ai-test-button";

const usd = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Casablanca" });

export async function AiSettingsCard() {
  const configured = isAiConfigured();
  const enabled = isAiFeatureEnabled();
  const usage = await getAiUsageSummary(configured);
  const budget = aiMonthlyBudgetUsd();
  const budgetUsed = budget > 0 ? Math.min(100, Math.round((usage.monthCostUsd / budget) * 100)) : 100;

  return (
    <Card id="ia" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Intelligence artificielle (OpenAI)</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        {!enabled && (
          <p className="rounded-lg border bg-muted/50 px-3 py-2 text-muted-foreground">
            <strong className="text-foreground">IA en pause.</strong> Le bouton « Générer avec l&apos;IA » est masqué sur la page
            Nouveau produit. Pour l&apos;activer : <code>AI_ENABLED=true</code> dans le fichier <code>.env</code>, puis redémarrer le site.
          </p>
        )}
        <p className="flex items-center gap-2 font-medium">
          {configured ? (
            <>
              <CircleCheck className="size-4 text-emerald-600" aria-hidden />
              Clé API configurée · modèle <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{aiModel()}</code>
            </>
          ) : (
            <>
              <CircleX className="size-4 text-muted-foreground" aria-hidden />
              Non configurée
            </>
          )}
        </p>

        {usage.lastAccountError && (
          <div role="alert" className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="break-words">
              Dernier essai ({date.format(usage.lastAccountError.at)}) : {AI_MESSAGES[usage.lastAccountError.kind]}
            </span>
          </div>
        )}

        {configured && (
          <dl className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="rounded-lg bg-muted/50 p-3">
              <dt className="text-xs text-muted-foreground">Utilisations ce mois-ci</dt>
              <dd className="text-lg font-semibold tabular-nums">{usage.monthCount}</dd>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <dt className="text-xs text-muted-foreground">Coût estimé ce mois-ci</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {usd.format(usage.monthCostUsd)} <span className="text-sm font-normal text-muted-foreground">/ {usd.format(budget)}</span>
              </dd>
              <dd className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`Plafond utilisé à ${budgetUsed} %`}>
                <div className={budgetUsed >= 90 ? "h-full bg-amber-500" : "h-full bg-emerald-500"} style={{ width: `${budgetUsed}%` }} />
              </dd>
            </div>
          </dl>
        )}

        {configured ? (
          <AiTestButton />
        ) : (
          <p className="text-muted-foreground">{AI_MESSAGES.not_configured}</p>
        )}

        <details className="rounded-lg border px-3 py-2">
          <summary className="cursor-pointer font-medium">Comment fonctionne la facturation ?</summary>
          <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-muted-foreground">
            <li>
              L&apos;IA utilise le compte OpenAI <strong>du magasin</strong>, créé sur{" "}
              <a href="https://platform.openai.com" target="_blank" rel="noopener noreferrer" className="underline">platform.openai.com</a>.
              C&apos;est un compte différent de l&apos;abonnement ChatGPT (Plus, Pro…), qui ne fonctionne pas pour un site web.
            </li>
            <li>Paiement à l&apos;utilisation : on ajoute du crédit (Billing) et chaque proposition coûte quelques centimes.</li>
            <li>
              Double sécurité : le site s&apos;arrête de lui-même au plafond mensuel ci-dessus (AI_MONTHLY_BUDGET_USD dans le .env,
              10 $ par défaut). Fixez aussi un plafond dans Billing › Limits du compte OpenAI.
            </li>
            <li>Ordre de grandeur : nom + description ≈ 0,001 $ par produit ; mises en scène IA (option) ≈ 0,10 $ par produit. Photos fond blanc et montages : gratuits.</li>
            <li>Le coût affiché ici est une estimation ; le montant exact est sur le tableau de bord OpenAI.</li>
            <li>La clé API se met dans le fichier <code>.env</code> du serveur (OPENAI_API_KEY). Elle n&apos;est jamais envoyée au navigateur.</li>
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}
