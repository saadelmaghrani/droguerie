"use client";

// Page « Nouveau produit » : UNE photo + UN bouton « Générer avec l'IA ».
// Le serveur prépare en une fois : photo principale fond blanc (produit intact), 2 mises en scène,
// nom + description. Rien n'est enregistré avant « Créer le produit » (voir draft-photos.tsx).
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { CircleAlert, CircleCheck, Loader2, RotateCcw, Sparkles, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EXTRA_COUNTS, estimateGenerationUsd, formatUsd, TYPICAL_COST_USD, type ExtraCount, type ExtraKind } from "@/lib/ai-costs";
import { discardProductDraftAction, generateProductDraftAction } from "@/server/ai/actions";
import { NOTES_MAX_LENGTH as NOTES_MAX } from "@/server/ai/product-text-prompt";
import type { DraftPart, DraftResult } from "@/server/ai/draft-service";
import { ImageDropzone } from "../../_components/image-dropzone";

export type ProductDraft = Extract<DraftResult, { ok: true }>;

const STEPS = ["Photo principale fond blanc (produit intact)", "2 montages (studio, table) avec le produit d'origine", "Nom et description"];

export function NewProductAi({
  configured,
  draft,
  hints,
  disabled,
  onGenerating,
  onGenerated,
  onReset,
}: {
  configured: boolean;
  draft: ProductDraft | null;
  hints: { name: string; categoryId: string };
  disabled: boolean;
  onGenerating: (busy: boolean) => void;
  onGenerated: (draft: ProductDraft) => void;
  onReset: () => void;
}) {
  const [file, setFile] = useState<{ file: File; url: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Photos supplémentaires : 2 montages gratuits par défaut ; les mises en scène IA (payantes) sont un choix explicite.
  const [extraCount, setExtraCount] = useState<ExtraCount>(2);
  const [extraKind, setExtraKind] = useState<ExtraKind>("montage");
  const [notes, setNotes] = useState("");
  const aiScenes = extraKind === "ai" && extraCount > 0;
  const cost = estimateGenerationUsd({ extraCount, extraKind, openAiConfigured: configured });

  useEffect(() => () => {
    if (file) URL.revokeObjectURL(file.url);
  }, [file]);

  function generate() {
    if (!file) return;
    setError(null);
    onGenerating(true);
    const data = new FormData();
    data.set("file", file.file);
    data.set("name", hints.name);
    data.set("categoryId", hints.categoryId);
    data.set("extraCount", String(extraCount));
    data.set("extraKind", extraKind);
    data.set("notes", notes);
    startTransition(async () => {
      try {
        const result = await generateProductDraftAction(data);
        if (result.ok) {
          onGenerated(result);
          const failures = [result.studio, result.text, ...result.extras.map((e) => e.part)].filter((p) => !p.ok).length;
          if (failures === 0) toast.success("Proposition prête : vérifiez les photos et le texte, puis créez le produit.");
          else toast.warning("Proposition partielle : certaines parties n'ont pas pu être générées (détails ci-dessous).");
        } else setError(result.message);
      } catch {
        setError("Le serveur ne répond pas. Vérifiez la connexion et réessayez.");
      } finally {
        onGenerating(false);
      }
    });
  }

  function reset() {
    if (draft) void discardProductDraftAction(draft.draftId);
    setFile(null);
    setError(null);
    onReset();
  }

  return (
    <Card className="border-violet-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-violet-600" aria-hidden />
          Générer avec l&apos;IA
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {draft ? (
          <>
            <ul className="grid gap-1.5 text-sm">
              <PartLine label={STEPS[0]!} part={draft.studio} />
              {draft.extras.map((extra) => (
                <PartLine key={extra.slot} label={extra.kind === "ai" ? extra.label : `Montage : ${extra.label.toLowerCase()}`} part={extra.part} />
              ))}
              <PartLine label={STEPS[2]!} part={draft.text} />
            </ul>
            <p className="text-sm text-muted-foreground">
              Relisez le nom et la description ci-dessous, choisissez les photos à garder, puis cliquez sur « Créer le produit ».
            </p>
            <div>
              <Button type="button" variant="outline" size="sm" onClick={reset} disabled={disabled}>
                <RotateCcw className="size-4" aria-hidden />
                Recommencer avec une autre photo
              </Button>
            </div>
          </>
        ) : isPending ? (
          <div className="grid gap-3" aria-live="polite">
            <ul className="grid gap-1.5 text-sm">
              {[
                STEPS[0]!,
                ...(extraCount === 0 ? [] : [extraKind === "ai" ? `${extraCount} mise${extraCount > 1 ? "s" : ""} en scène IA (OpenAI)` : `${extraCount} montage${extraCount > 1 ? "s" : ""} avec le produit d'origine`]),
                ...(configured ? [STEPS[2]!] : []),
              ].map((step) => (
                <li key={step} className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
                  {step}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              {aiScenes ? "Génération en cours, environ une minute. Ne fermez pas la page." : "Génération en cours, quelques secondes…"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-[12rem_1fr] sm:items-start">
              {file ? (
                <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted/30">
                  {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) */}
                  <img src={file.url} alt="Photo du produit à traiter" className="absolute inset-0 size-full object-contain" />
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    onClick={() => setFile(null)}
                    aria-label="Retirer la photo"
                    className="absolute top-2 right-2 size-7 shadow-sm"
                  >
                    <X className="size-4" aria-hidden />
                  </Button>
                </div>
              ) : (
                <ImageDropzone
                  label="Photo du produit"
                  hint="Une seule photo · produit bien visible"
                  pending={false}
                  disabled={disabled}
                  onFile={(f) => setFile({ file: f, url: URL.createObjectURL(f) })}
                  className="aspect-square w-full"
                />
              )}
              <div className="grid gap-3 text-sm">
                <p>À partir d&apos;une seule photo, en un clic : photo principale sur fond blanc (<strong>produit strictement identique</strong>), photos supplémentaires au choix, nom et description (sans prix, sans caractéristique inventée).</p>

                <fieldset className="grid gap-2" disabled={disabled}>
                  <legend className="mb-1 font-medium">Photos supplémentaires</legend>
                  <div role="radiogroup" aria-label="Nombre de photos supplémentaires" className="flex w-fit gap-1 rounded-lg bg-muted p-1">
                    {EXTRA_COUNTS.map((count) => (
                      <label
                        key={count}
                        className={`cursor-pointer rounded-md px-3 py-1.5 font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                          extraCount === count ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <input type="radio" name="ai-extra-count" value={count} checked={extraCount === count} onChange={() => setExtraCount(count)} className="sr-only" />
                        {count === 0 ? "Aucune" : count}
                      </label>
                    ))}
                  </div>
                  {extraCount > 0 && (
                    <div className="grid gap-1.5">
                      {([
                        ["montage", "Montages avec le produit d'origine", "Studio, table en bois. Produit identique au pixel près. Gratuit."],
                        ["ai", "Mises en scène IA réalistes", `Redessinées par OpenAI (à vérifier), ${formatUsd(TYPICAL_COST_USD.aiScene)} par photo, environ une minute.`],
                      ] as const).map(([kind, label, hint]) => (
                        <label
                          key={kind}
                          className={`flex items-start gap-2 rounded-lg border p-2.5 ${kind === "ai" && !configured ? "opacity-60" : "cursor-pointer"} ${extraKind === kind ? "border-primary bg-primary/5" : ""}`}
                        >
                          <input
                            type="radio"
                            name="ai-extra-kind"
                            value={kind}
                            checked={extraKind === kind}
                            disabled={kind === "ai" && !configured}
                            onChange={() => setExtraKind(kind)}
                            className="mt-0.5 accent-primary"
                          />
                          <span className="grid gap-0.5">
                            <span className="font-medium">{label}</span>
                            <span className="text-xs text-muted-foreground">{hint}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>

                <div className="grid gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="ai-notes">Notes pour l&apos;IA <span className="font-normal text-muted-foreground">(facultatif)</span></Label>
                    <span className="text-xs tabular-nums text-muted-foreground">{notes.length}/{NOTES_MAX}</span>
                  </div>
                  <Textarea
                    id="ai-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value.slice(0, NOTES_MAX))}
                    maxLength={NOTES_MAX}
                    rows={3}
                    disabled={disabled || !configured}
                    placeholder="Ex. : marque Spontex, lot de 10, face abrasive pour casseroles, convient aux surfaces fragiles…"
                  />
                  <p className="text-xs text-muted-foreground">
                    Matière, marque, taille, usage, argument clé… L&apos;IA s&apos;appuie dessus en priorité pour le nom et la description.
                  </p>
                </div>

                <p className="text-sm" aria-live="polite">
                  Coût estimé de cette génération : <strong>{formatUsd(cost)}</strong>
                  {aiScenes && <span className="text-muted-foreground"> (dont {extraCount} × {formatUsd(TYPICAL_COST_USD.aiScene).replace("≈ ", "")} de mises en scène)</span>}
                </p>
                {!configured && (
                  <p className="flex items-start gap-1.5 text-amber-800">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      OpenAI n&apos;est pas configuré : seules les photos (fond blanc et montages) seront générées, pas le texte.{" "}
                      <Link href="/admin/parametres#ia" className="underline">Paramètres</Link>
                    </span>
                  </p>
                )}
                <div>
                  <Button type="button" onClick={generate} disabled={!file || disabled}>
                    <Sparkles className="size-4" aria-hidden />
                    Générer avec l&apos;IA
                  </Button>
                </div>
              </div>
            </div>
            {error && (
              <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {error}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PartLine({ label, part }: { label: string; part: DraftPart<unknown> | undefined }) {
  if (!part) return null;
  if (part.ok) {
    return (
      <li className="flex items-center gap-2">
        <CircleCheck className="size-4 text-emerald-600" aria-hidden />
        {label}
      </li>
    );
  }
  return (
    <li className={`grid gap-0.5 ${part.accountAction ? "text-amber-800" : "text-destructive"}`}>
      <span className="flex items-center gap-2">
        {part.accountAction ? <TriangleAlert className="size-4 shrink-0" aria-hidden /> : <CircleAlert className="size-4 shrink-0" aria-hidden />}
        {label} : non générée
      </span>
      <span className="pl-6 text-xs break-words">
        {part.message}
        {part.accountAction && (
          <>
            {" "}
            <Link href="/admin/parametres#ia" className="underline">État du compte OpenAI</Link>
          </>
        )}
      </span>
    </li>
  );
}
