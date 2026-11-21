"use client";

// Assistant IA de la fiche produit : propose un nom et une description.
// L'admin relit et MODIFIE la proposition ici, puis « Utiliser » la recopie dans le formulaire :
// rien n'est enregistré ni publié tant qu'il ne clique pas sur « Enregistrer ».
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, CircleAlert, Loader2, RefreshCw, Sparkles, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { decideProductTextAction, suggestProductTextAction, type ProductTextHintsInput } from "@/server/ai/actions";

type Suggestion = { generationId: string; name: string; description: string; usedPhoto: boolean };
type Failure = { message: string; accountAction: boolean };

export function AiAssistant({
  productId,
  configured,
  hasPhoto,
  hints,
  onApply,
}: {
  productId: string;
  configured: boolean;
  hasPhoto: boolean;
  hints: ProductTextHintsInput;
  onApply: (text: { name: string; description: string }) => void;
}) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [isPending, startTransition] = useTransition();

  function suggest() {
    // Une nouvelle demande remplace la précédente : celle-ci est considérée comme refusée.
    if (suggestion) void decideProductTextAction(suggestion.generationId, false);
    setFailure(null);
    startTransition(async () => {
      try {
        const result = await suggestProductTextAction(productId, hints);
        if (result.ok) setSuggestion({ generationId: result.generationId, ...result.suggestion, usedPhoto: result.usedPhoto });
        else {
          setSuggestion(null);
          setFailure({ message: result.message, accountAction: result.accountAction });
        }
      } catch {
        setFailure({ message: "Le serveur ne répond pas. Vérifiez la connexion et réessayez.", accountAction: false });
      }
    });
  }

  function decide(accepted: boolean) {
    if (!suggestion) return;
    if (accepted) {
      onApply({ name: suggestion.name.trim(), description: suggestion.description.trim() });
      toast.success("Texte recopié dans la fiche. Relisez puis cliquez sur « Enregistrer ».");
    }
    void decideProductTextAction(suggestion.generationId, accepted);
    setSuggestion(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet-600" aria-hidden />
          Assistant IA
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!configured ? (
          <p className="text-sm text-muted-foreground">
            L&apos;IA n&apos;est pas configurée (clé OpenAI absente).{" "}
            <Link href="/admin/parametres#ia" className="underline">Voir les explications</Link>.
          </p>
        ) : (
          <>
            {!suggestion && (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={suggest} disabled={isPending}>
                  {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
                  {isPending ? "Rédaction en cours…" : "Proposer un nom et une description"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {hasPhoto
                    ? "À partir de la photo principale et des informations saisies."
                    : "Sans photo, l'IA n'utilise que les informations saisies : ajoutez une photo pour un meilleur résultat."}
                </p>
              </div>
            )}

            {failure && (
              <div
                role="alert"
                className={
                  failure.accountAction
                    ? "grid gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                    : "grid gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                }
              >
                <p className="flex items-start gap-1.5">
                  {failure.accountAction ? (
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  ) : (
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  )}
                  <span className="break-words">{failure.message}</span>
                </p>
                {failure.accountAction && (
                  <Link href="/admin/parametres#ia" className="text-xs underline">État du compte OpenAI dans les Paramètres</Link>
                )}
              </div>
            )}

            {suggestion && (
              <div className="grid gap-4 rounded-lg border border-violet-200 bg-violet-50/50 p-4">
                <p className="text-sm text-muted-foreground">
                  Proposition de l&apos;IA{suggestion.usedPhoto ? " (d'après la photo)" : ""} : relisez et corrigez si besoin.
                  L&apos;IA peut se tromper, vérifiez surtout les contenances et les marques.
                </p>
                <div className="grid gap-2">
                  <Label htmlFor="ai-name">Nom proposé</Label>
                  <Input
                    id="ai-name"
                    value={suggestion.name}
                    maxLength={120}
                    onChange={(e) => setSuggestion({ ...suggestion, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ai-description">Description proposée</Label>
                  <Textarea
                    id="ai-description"
                    value={suggestion.description}
                    maxLength={5000}
                    rows={7}
                    onChange={(e) => setSuggestion({ ...suggestion, description: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => decide(true)} disabled={suggestion.name.trim().length < 2}>
                    <Check className="size-4" aria-hidden />
                    Utiliser ce texte
                  </Button>
                  <Button type="button" variant="outline" onClick={suggest} disabled={isPending}>
                    {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
                    Autre proposition
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => decide(false)} disabled={isPending}>
                    <X className="size-4" aria-hidden />
                    Refuser
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
