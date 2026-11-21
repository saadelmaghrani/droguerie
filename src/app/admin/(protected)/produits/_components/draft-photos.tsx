"use client";

// Aperçu des photos générées (page « Nouveau produit ») :
//  - photo principale : fond blanc (recommandé) ou photo d'origine ;
//  - photos supplémentaires : montages locaux (produit d'origine, cochés par défaut) et, si demandées,
//    mises en scène IA (redessinées, décochées par défaut). 2 au maximum (3 photos par produit).
// Rien n'est enregistré ici : le choix est appliqué après « Créer le produit ».
import { ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { DraftChoice, ExtraSlot } from "@/server/ai/draft-service";
import type { ProductDraft } from "./new-product-ai";

export type { DraftChoice };
export const MAX_EXTRAS = 2;

/** Choix initial : fond blanc si disponible, montages réussis cochés (2 max), mises en scène IA décochées. */
export function defaultDraftChoice(draft: ProductDraft): DraftChoice {
  const keep: ExtraSlot[] = draft.extras.filter((e) => e.kind === "montage" && e.part.ok).map((e) => e.slot).slice(0, MAX_EXTRAS);
  return { main: draft.studio.ok ? "studio" : "original", keep };
}

function Thumb({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element -- tailles WebP déjà générées */}
      <img src={src} alt={alt} className="absolute inset-0 size-full object-contain" />
    </div>
  );
}

export function DraftPhotos({
  draft,
  choice,
  onChange,
  disabled,
}: {
  draft: ProductDraft;
  choice: DraftChoice;
  onChange: (choice: DraftChoice) => void;
  disabled: boolean;
}) {
  const mainOptions = [
    ...(draft.studio.ok ? [{ value: "studio" as const, label: "Fond blanc (recommandé)", hint: "Produit identique, fond remplacé", image: draft.studio.value }] : []),
    { value: "original" as const, label: "Photo d'origine", hint: "Telle que vous l'avez envoyée", image: draft.original },
  ];
  const extras = draft.extras.filter((e) => e.part.ok);
  const hasAi = extras.some((e) => e.kind === "ai");
  const full = choice.keep.length >= MAX_EXTRAS;

  const toggle = (slot: ExtraSlot, checked: boolean) =>
    onChange({ ...choice, keep: checked ? [...choice.keep, slot] : choice.keep.filter((s) => s !== slot) });

  return (
    <div className="grid gap-6">
      <fieldset className="grid gap-3" disabled={disabled}>
        <legend className="mb-2 text-sm font-medium">Photo principale</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {mainOptions.map((option) => (
            <label
              key={option.value}
              className={cn(
                "grid cursor-pointer gap-2 rounded-lg border p-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                choice.main === option.value ? "border-primary bg-primary/5" : "hover:bg-muted/50",
              )}
            >
              <Thumb src={mediaUrl(option.image.key, 800)} alt={option.label} />
              <span className="flex items-start gap-2">
                <input
                  type="radio"
                  name="draft-main"
                  value={option.value}
                  checked={choice.main === option.value}
                  onChange={() => onChange({ ...choice, main: option.value })}
                  className="mt-1 accent-primary"
                />
                <span className="grid">
                  <span className="text-sm font-medium">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.hint}</span>
                </span>
              </span>
            </label>
          ))}
        </div>
        {draft.studio.ok && (
          <p className="text-xs text-muted-foreground">
            Vérifiez que le détourage n&apos;a rien coupé (bouchon, poignée, partie de même couleur que le fond). Sinon, gardez la photo d&apos;origine.
          </p>
        )}
      </fieldset>

      {extras.length > 0 && (
        <fieldset className="grid gap-3" disabled={disabled}>
          <legend className="mb-2 text-sm font-medium">
            Photos supplémentaires <span className="font-normal text-muted-foreground">({choice.keep.length}/{MAX_EXTRAS} choisies)</span>
          </legend>
          {hasAi && (
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Les mises en scène IA sont redessinées : comparez la marque, le logo, les inscriptions et les couleurs avec le
              produit réel avant de les garder.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {extras.map((extra) =>
              extra.part.ok ? (
                <label
                  key={extra.slot}
                  className={cn(
                    "grid content-start gap-2 rounded-lg border p-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    choice.keep.includes(extra.slot) ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                    full && !choice.keep.includes(extra.slot) ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                  )}
                >
                  <div className="relative">
                    <Thumb src={mediaUrl(extra.part.value.key, 800)} alt={extra.label} />
                    <Badge variant="secondary" className="absolute top-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate">
                      {extra.kind === "ai" ? <Sparkles className="size-3" aria-hidden /> : <ShieldCheck className="size-3" aria-hidden />}
                      {extra.kind === "ai" ? "Générée par l'IA" : "Produit d'origine"}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{extra.label}</span>
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      data-slot-id={extra.slot}
                      checked={choice.keep.includes(extra.slot)}
                      disabled={full && !choice.keep.includes(extra.slot)}
                      onChange={(e) => toggle(extra.slot, e.target.checked)}
                      className="size-4 accent-primary"
                    />
                    Garder cette photo
                  </span>
                </label>
              ) : null,
            )}
          </div>
          {full && extras.length > MAX_EXTRAS && (
            <p className="text-xs text-muted-foreground">3 photos maximum par produit : décochez une photo pour en choisir une autre.</p>
          )}
        </fieldset>
      )}
    </div>
  );
}
