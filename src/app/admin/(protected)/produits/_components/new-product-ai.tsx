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
import { discardProductDraftAction, generateProductDraftAction } from "@/server/ai/actions";
import type { DraftPart, DraftResult } from "@/server/ai/draft-service";
import { ImageDropzone } from "../../_components/image-dropzone";

export type ProductDraft = Extract<DraftResult, { ok: true }>;

const STEPS = ["Photo principale fond blanc (produit intact)", "2 photos de mise en scène", "Nom et description"];

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
    startTransition(async () => {
      try {
        const result = await generateProductDraftAction(data);
        if (result.ok) {
          onGenerated(result);
          const failures = [result.studio, result.text, ...result.scenes].filter((p) => !p.ok).length;
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
              <PartLine label="Photo de mise en scène 1" part={draft.scenes[0]} />
              <PartLine label="Photo de mise en scène 2" part={draft.scenes[1]} />
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
              {STEPS.map((step) => (
                <li key={step} className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
                  {step}
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">Génération en cours, environ une minute. Ne fermez pas la page.</p>
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
                <p>À partir d&apos;une seule photo, en un clic :</p>
                <ul className="grid list-disc gap-1 pl-5 text-muted-foreground">
                  <li>photo principale sur fond blanc, <strong>produit strictement identique</strong> ;</li>
                  <li>2 photos de mise en scène (générées par OpenAI, à vérifier) ;</li>
                  <li>nom et description en français (sans prix, sans caractéristique inventée).</li>
                </ul>
                {!configured && (
                  <p className="flex items-start gap-1.5 text-amber-800">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>
                      OpenAI n&apos;est pas configuré : seule la photo fond blanc sera générée.{" "}
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
