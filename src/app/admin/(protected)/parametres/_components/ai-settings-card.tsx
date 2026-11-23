// Encadré « Assistant IA » des Paramètres, en langage simple pour le commerçant : état (disponible ou
// non), consommation du mois, dernière alerte et bouton de test. Composant serveur.
// AUCUN détail technique ici (fichier de configuration, variable, clé, code HTTP) : le diagnostic
// complet est écrit dans le journal du serveur (démarrage : instrumentation.ts ; erreurs : logAiError).
import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { aiMonthlyBudgetUsd, isAiFeatureEnabled } from "@/server/ai/client";
import { AI_MESSAGES, KEY_ERROR_KINDS } from "@/server/ai/errors";
import { inspectApiKey } from "@/server/ai/key-check";
import { getAiUsageSummary } from "@/server/ai/product-text";
import { AiTestButton } from "./ai-test-button";

const usd = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Casablanca" });

export async function AiSettingsCard() {
  const enabled = isAiFeatureEnabled();
  const check = inspectApiKey(process.env.OPENAI_API_KEY);
  const ready = check.ok;
  const usage = await getAiUsageSummary(ready);
  const lastError = usage.lastAccountError;
  // L'échec enregistré concernait une AUTRE clé que celle installée maintenant : il est réglé, on ne l'affiche plus.
  const outdated = Boolean(
    lastError?.keyHint && check.hint && lastError.keyHint !== check.hint && KEY_ERROR_KINDS.includes(lastError.kind),
  );
  const budget = aiMonthlyBudgetUsd();
  const budgetUsed = budget > 0 ? Math.min(100, Math.round((usage.monthCostUsd / budget) * 100)) : 100;

  return (
    <Card id="ia" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Assistant IA</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm">
        {!enabled ? (
          <p className="rounded-lg border bg-muted/50 px-3 py-2 text-muted-foreground">
            <strong className="text-foreground">Assistant IA désactivé.</strong> Vous créez et modifiez vos produits normalement, à la
            main. Pour l&apos;activer, contactez votre prestataire.
          </p>
        ) : ready ? (
          <p className="flex items-center gap-2 font-medium">
            <CircleCheck className="size-4 text-emerald-600" aria-hidden />
            Assistant IA activé
          </p>
        ) : (
          <p className="flex items-start gap-2 font-medium">
            <CircleX className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span>
              Assistant IA indisponible pour le moment.{" "}
              <span className="font-normal text-muted-foreground">
                Vos produits se créent et se modifient normalement à la main. Si cela dure, contactez votre prestataire.
              </span>
            </span>
          </p>
        )}

        {enabled && lastError && !outdated && (
          <div role="alert" className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="break-words">
              Dernier essai ({date.format(lastError.at)}) : {AI_MESSAGES[lastError.kind]}
            </span>
          </div>
        )}

        {enabled && ready && (
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

        {enabled && ready && <AiTestButton />}

        {enabled && (
          <details className="rounded-lg border px-3 py-2">
            <summary className="cursor-pointer font-medium">Comment fonctionne la facturation ?</summary>
            <ul className="mt-2 grid list-disc gap-1.5 pl-5 text-muted-foreground">
              <li>
                L&apos;assistant utilise le compte OpenAI <strong>du magasin</strong> (platform.openai.com). C&apos;est un compte
                différent de l&apos;abonnement ChatGPT (Plus, Pro…).
              </li>
              <li>Paiement à l&apos;utilisation : on ajoute du crédit au compte et chaque proposition coûte quelques centimes.</li>
              <li>
                Double sécurité : le site s&apos;arrête de lui-même au plafond mensuel ci-dessus. Un plafond peut aussi être fixé sur le
                compte OpenAI.
              </li>
              <li>Ordre de grandeur : nom + description ≈ 0,001 $ par produit ; photos IA (option) ≈ 0,10 $ par produit. Photos fond blanc et montages : gratuits.</li>
              <li>Le coût affiché ici est une estimation ; le montant exact est sur le tableau de bord OpenAI.</li>
              <li>Si l&apos;assistant est indisponible, rien n&apos;est bloqué : remplissez simplement la fiche à la main.</li>
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
