"use client";

// Aperçu des photos générées (page « Nouveau produit ») : choix de la photo principale
// (fond blanc ou d'origine) et case « Garder » pour chaque mise en scène (décochée par défaut :
// une image redessinée par l'IA doit être choisie volontairement). Rien n'est enregistré ici.
import { Sparkles, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { ProductDraft } from "./new-product-ai";

export type DraftChoice = { main: "studio" | "original"; keepScenes: boolean[] };

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
  const scenes = draft.scenes.map((part, index) => ({ part, index })).filter((s) => s.part.ok);

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
      </fieldset>

      {scenes.length > 0 && (
        <fieldset className="grid gap-3" disabled={disabled}>
          <legend className="mb-2 text-sm font-medium">Photos supplémentaires</legend>
          <p className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Ces photos sont redessinées par l&apos;IA : comparez la marque, le logo, les inscriptions et les couleurs avec le
            produit réel. Cochez seulement celles qui sont fidèles.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {scenes.map(({ part, index }) =>
              part.ok ? (
                <label
                  key={index}
                  className={cn(
                    "grid cursor-pointer gap-2 rounded-lg border p-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    choice.keepScenes[index] ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  )}
                >
                  <div className="relative">
                    <Thumb src={mediaUrl(part.value.key, 800)} alt={`Mise en scène ${index + 1}`} />
                    <Badge variant="secondary" className="absolute top-2 left-2">
                      <Sparkles className="size-3" aria-hidden />
                      Générée par l&apos;IA
                    </Badge>
                  </div>
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={choice.keepScenes[index] ?? false}
                      onChange={(e) => {
                        const keepScenes = [...choice.keepScenes];
                        keepScenes[index] = e.target.checked;
                        onChange({ ...choice, keepScenes });
                      }}
                      className="size-4 accent-primary"
                    />
                    Garder cette photo
                  </span>
                </label>
              ) : null,
            )}
          </div>
        </fieldset>
      )}
    </div>
  );
}
