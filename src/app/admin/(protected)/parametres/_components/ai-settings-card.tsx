// Encadré « Intelligence artificielle » des Paramètres : état de la clé OpenAI (format, provenance,
// conflits entre fichiers .env), consommation du mois, dernière erreur de compte (clé refusée, crédit
// épuisé…) et bouton de test. Composant serveur ; la clé n'est jamais affichée (seulement « sk-…abcd »).
import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { aiModel, aiMonthlyBudgetUsd, isAiConfigured, isAiFeatureEnabled } from "@/server/ai/client";
import { AI_MESSAGES, KEY_ERROR_KINDS } from "@/server/ai/errors";
import { KEY_ISSUE_MESSAGES } from "@/server/ai/key-check";
import { getApiKeyStatus, reloadInstructions, type ApiKeyStatus } from "@/server/ai/key-status";
import { getAiUsageSummary } from "@/server/ai/product-text";
import { AiTestButton } from "./ai-test-button";

const usd = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Casablanca" });

export async function AiSettingsCard() {
  const configured = isAiConfigured();
  const enabled = isAiFeatureEnabled();
  const [usage, keyStatus] = await Promise.all([getAiUsageSummary(configured), getApiKeyStatus()]);
  const currentHint = keyStatus.check.hint;
  const lastError = usage.lastAccountError;
  // L'erreur enregistrée concernait une AUTRE clé que celle lue maintenant : elle est sans doute réglée.
  const errorFromOldKey = Boolean(lastError?.keyHint && currentHint && lastError.keyHint !== currentHint && KEY_ERROR_KINDS.includes(lastError.kind));
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
        <KeyStatusBlock status={keyStatus} model={aiModel()} />

        {lastError &&
          (errorFromOldKey ? (
            <p className="rounded-lg border bg-muted/50 px-3 py-2 text-muted-foreground">
              Le dernier échec ({date.format(lastError.at)}) concernait l&apos;ancienne clé <code>{lastError.keyHint}</code>. La clé
              actuelle (<code>{currentHint}</code>) n&apos;a pas encore servi : cliquez sur « Tester la connexion » pour la vérifier.
            </p>
          ) : (
            <div role="alert" className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="break-words">
                Dernier essai ({date.format(lastError.at)}
                {lastError.keyHint ? <>, clé <code>{lastError.keyHint}</code></> : null}) : {AI_MESSAGES[lastError.kind]}
              </span>
            </div>
          ))}

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
          <summary className="cursor-pointer font-medium">Changer ou corriger la clé API</summary>
          <ol className="mt-2 grid list-decimal gap-1.5 pl-5 text-muted-foreground">
            <li>
              Créez une clé sur{" "}
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">
                platform.openai.com/api-keys
              </a>{" "}
              (bouton « Create new secret key ») et copiez-la en entier.
            </li>
            <li>
              Dans le fichier <code>.env</code> du serveur, remplacez la ligne par <code>OPENAI_API_KEY=sk-…</code> : sans guillemets,
              sans espace, sur une seule ligne. Gardez la clé à <strong>un seul endroit</strong> (pas aussi dans .env.local).
            </li>
            <li>{reloadInstructions(keyStatus.environment)}</li>
            <li>Rechargez cette page : l&apos;indice <code>sk-…</code> ci-dessus doit correspondre à la nouvelle clé (4 derniers caractères, comme sur OpenAI), puis cliquez sur « Tester la connexion ».</li>
          </ol>
        </details>

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

function KeyStatusBlock({ status, model }: { status: ApiKeyStatus; model: string }) {
  const { check, source, publicLeaks } = status;
  const where = source
    ? source.file
      ? <>lue depuis le fichier <code>{source.file}</code></>
      : <>lue depuis une variable d&apos;environnement du système (shell, Docker…), prioritaire sur les fichiers .env</>
    : null;
  return (
    <div className="grid gap-2">
      {check.ok ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
          <CircleCheck className="size-4 text-emerald-600" aria-hidden />
          Clé API au bon format <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{check.hint}</code>· modèle{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{model}</code>
        </p>
      ) : check.issue === "missing" ? (
        <p className="flex items-center gap-2 font-medium">
          <CircleX className="size-4 text-muted-foreground" aria-hidden />
          Clé API absente
        </p>
      ) : (
        <div role="alert" className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive">
          <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="break-words">
            <strong>Clé API mal formatée</strong>
            {check.hint ? <> (<code>{check.hint}</code>)</> : null} : {KEY_ISSUE_MESSAGES[check.issue]} Rien n&apos;est envoyé à OpenAI tant
            qu&apos;elle n&apos;est pas corrigée.
          </span>
        </div>
      )}
      {where && <p className="text-muted-foreground">Clé {where}.</p>}
      {source && source.shadowed.length > 0 && (
        <div role="alert" className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="break-words">
            Attention : {source.shadowed.map((f) => <code key={f} className="mr-1">{f}</code>)} contient une AUTRE valeur de
            OPENAI_API_KEY, ignorée car {source.file ? <code>{source.file}</code> : "la variable du système"} est prioritaire. Gardez la clé
            à un seul endroit pour éviter de modifier le mauvais fichier.
          </span>
        </div>
      )}
      {publicLeaks.length > 0 && (
        <div role="alert" className="flex items-start gap-1.5 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-destructive">
          <CircleX className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="break-words">
            Danger : {publicLeaks.join(", ")} contient une clé OpenAI. Les variables NEXT_PUBLIC_ sont envoyées au navigateur :
            supprimez-la, puis révoquez cette clé sur platform.openai.com.
          </span>
        </div>
      )}
    </div>
  );
}
