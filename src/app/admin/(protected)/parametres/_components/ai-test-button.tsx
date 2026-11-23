"use client";

import { useState, useTransition } from "react";
import { CircleAlert, CircleCheck, Loader2, PlugZap, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { testAiConnectionAction } from "@/server/ai/actions";

type Result = { ok: true; model: string; keyHint: string | null } | { ok: false; message: string; accountAction: boolean; keyHint: string | null };

/** Vérifie la clé ET le crédit avec une toute petite requête (coût négligeable). */
export function AiTestButton() {
  const [result, setResult] = useState<Result | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="grid gap-2">
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              try {
                setResult(await testAiConnectionAction());
              } catch {
                setResult({ ok: false, message: "Le serveur ne répond pas. Réessayez.", accountAction: false, keyHint: null });
              }
            })
          }
        >
          {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <PlugZap className="size-4" aria-hidden />}
          Tester la connexion
        </Button>
      </div>
      <div aria-live="polite">
        {result?.ok && (
          <p className="flex items-center gap-1.5 text-emerald-700">
            <CircleCheck className="size-4" aria-hidden />
            Connexion réussie{result.keyHint ? ` avec la clé ${result.keyHint}` : ""} : la clé et le crédit OpenAI sont valides.
          </p>
        )}
        {result && !result.ok && (
          <p className={`flex items-start gap-1.5 break-words ${result.accountAction ? "text-amber-800" : "text-destructive"}`}>
            {result.accountAction ? <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
            <span>
              {result.message}
              {result.keyHint && <span className="block text-xs opacity-80">Clé testée : {result.keyHint}</span>}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
