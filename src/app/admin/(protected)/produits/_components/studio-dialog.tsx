"use client";

// « Fond studio » de la photo principale : choix de la méthode → génération → comparaison
// avant / après → décision OBLIGATOIRE de l'admin (« Utiliser » ou « Garder l'originale »).
// Fermer la fenêtre sans choisir revient à garder l'originale.
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, CircleAlert, Loader2, ScanSearch, ShieldCheck, Sparkles, TriangleAlert, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { decideStudioAction, generateStudioAction } from "@/server/ai/studio-actions";

type Method = "cutout" | "openai";
type Step =
  | { name: "choose" }
  | { name: "generating"; method: Method }
  | { name: "compare"; method: Method; generationId: string; previewKey: string; originalKey: string }
  | { name: "error"; message: string; accountAction: boolean };

export function StudioDialog({
  open,
  onOpenChange,
  imageId,
  productName,
  aiConfigured,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageId: string;
  productName: string;
  aiConfigured: boolean;
}) {
  const [step, setStep] = useState<Step>({ name: "choose" });
  const [isDeciding, startDeciding] = useTransition();
  const [, startGenerating] = useTransition();
  const busy = step.name === "generating" || isDeciding;

  function close() {
    // Fermer sans choisir = garder l'originale (la variante est supprimée).
    if (step.name === "compare") void decideStudioAction(step.generationId, false);
    setStep({ name: "choose" });
    onOpenChange(false);
  }

  function generate(method: Method) {
    setStep({ name: "generating", method });
    startGenerating(async () => {
      try {
        const result = await generateStudioAction(imageId, method);
        if (result.ok) setStep({ name: "compare", method, generationId: result.generationId, previewKey: result.previewKey, originalKey: result.originalKey });
        else setStep({ name: "error", message: result.message, accountAction: result.accountAction });
      } catch {
        setStep({ name: "error", message: "Le serveur ne répond pas. Vérifiez la connexion et réessayez.", accountAction: false });
      }
    });
  }

  function decide(accepted: boolean) {
    if (step.name !== "compare") return;
    startDeciding(async () => {
      try {
        const result = await decideStudioAction(step.generationId, accepted);
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch {
        toast.error("Le serveur ne répond pas. Réessayez.");
        return;
      }
      setStep({ name: "choose" });
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Photo fond studio</DialogTitle>
          <DialogDescription>
            Une nouvelle version de la photo principale est préparée à côté de l&apos;originale. Rien ne change tant que vous
            n&apos;avez pas cliqué sur « Utiliser ».
          </DialogDescription>
        </DialogHeader>

        {step.name === "choose" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <MethodCard
              onClick={() => generate("cutout")}
              icon={<ShieldCheck className="size-5 text-emerald-600" aria-hidden />}
              title="Détourage fidèle"
              badge="Recommandé · gratuit"
              text="Le fond est retiré et remplacé par un fond studio uniforme. Le produit n'est pas redessiné : ses pixels, couleurs et inscriptions restent identiques à l'original."
            />
            <MethodCard
              onClick={() => generate("openai")}
              disabled={!aiConfigured}
              icon={<Sparkles className="size-5 text-violet-600" aria-hidden />}
              title="Version OpenAI"
              badge="Payant · compte OpenAI"
              text={
                aiConfigured
                  ? "Rendu plus « photo pro » (lumière, ombre). L'IA redessine l'image : vérifiez attentivement le texte, le logo et les couleurs avant de l'utiliser."
                  : "Indisponible : la clé OpenAI n'est pas configurée (voir Paramètres)."
              }
              warning={aiConfigured}
            />
          </div>
        )}

        {step.name === "generating" && (
          <div className="flex flex-col items-center gap-3 py-12 text-center" aria-live="polite">
            <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
            <p className="font-medium">{step.method === "cutout" ? "Détourage en cours…" : "OpenAI prépare l'image…"}</p>
            <p className="text-sm text-muted-foreground">
              {step.method === "cutout" ? "Quelques secondes." : "Cela peut prendre jusqu'à une minute. Ne fermez pas la page."}
            </p>
          </div>
        )}

        {step.name === "error" && (
          <div
            role="alert"
            className={cn(
              "grid gap-3 rounded-lg border px-4 py-3 text-sm",
              step.accountAction ? "border-amber-300 bg-amber-50 text-amber-900" : "border-destructive/30 bg-destructive/5 text-destructive",
            )}
          >
            <p className="flex items-start gap-1.5">
              {step.accountAction ? <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />}
              <span className="break-words">{step.message}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setStep({ name: "choose" })}>
                Réessayer
              </Button>
              {step.accountAction && (
                <Button type="button" variant="link" size="sm" asChild>
                  <Link href="/admin/parametres#ia">État du compte OpenAI</Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {step.name === "compare" && (
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Figure label="Avant (originale)" src={mediaUrl(step.originalKey, 800)} alt={`${productName} — photo originale`} />
              <Figure label="Après (fond studio)" src={mediaUrl(step.previewKey, 800)} alt={`${productName} — version fond studio`} highlight />
            </div>
            {step.method === "openai" ? (
              <p className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <ScanSearch className="mt-0.5 size-4 shrink-0" aria-hidden />
                Image redessinée par l&apos;IA : comparez attentivement la marque, le logo, les inscriptions, la contenance et les
                couleurs. Au moindre écart, gardez l&apos;originale.
              </p>
            ) : (
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                Produit identique à l&apos;original (seul le fond a changé). Vérifiez surtout les bords du détourage.
              </p>
            )}
          </div>
        )}

        {step.name === "compare" && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => decide(false)} disabled={isDeciding}>
              <Undo2 className="size-4" aria-hidden />
              Garder l&apos;originale
            </Button>
            <Button type="button" onClick={() => decide(true)} disabled={isDeciding}>
              {isDeciding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
              Utiliser
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MethodCard({
  onClick,
  disabled,
  icon,
  title,
  badge,
  text,
  warning,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  badge: string;
  text: string;
  warning?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="grid content-start gap-2 rounded-lg border p-4 text-left transition-colors hover:border-ring hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex items-center gap-2 font-medium">
        {icon}
        {title}
      </span>
      <span className="text-xs font-medium text-muted-foreground">{badge}</span>
      <span className={cn("text-sm", warning ? "text-amber-800" : "text-muted-foreground")}>{text}</span>
    </button>
  );
}

function Figure({ label, src, alt, highlight }: { label: string; src: string; alt: string; highlight?: boolean }) {
  return (
    <figure className="grid gap-2">
      <figcaption className="text-sm font-medium">{label}</figcaption>
      <div className={cn("relative aspect-square overflow-hidden rounded-lg border bg-muted/30", highlight && "ring-2 ring-primary")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- fichiers WebP déjà générés */}
        <img src={src} alt={alt} className="absolute inset-0 size-full object-contain" />
      </div>
    </figure>
  );
}
