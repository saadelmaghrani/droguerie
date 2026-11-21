"use client";

// Logo ou image de bannière : aperçu, envoi, remplacement, retrait.
import Image from "next/image";
import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/media";
import { removeStoreImage, uploadStoreImage } from "@/server/settings/image-actions";
import { ImageDropzone, useImagePicker } from "../../_components/image-dropzone";

export function StoreImageField({
  kind,
  label,
  hint,
  imageKey,
}: {
  kind: "logo" | "hero";
  label: string;
  hint: string;
  imageKey: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const run = (action: () => Promise<{ ok: boolean; message: string }>) =>
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch {
        toast.error("Envoi impossible. Vérifiez la connexion et réessayez.");
      }
    });
  const upload = (file: File) => {
    const data = new FormData();
    data.set("file", file);
    run(() => uploadStoreImage(kind, data));
  };
  const picker = useImagePicker(upload);
  const previewWidth = kind === "logo" ? 256 : 800;

  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      {imageKey ? (
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`relative overflow-hidden rounded-lg border bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] ${
              kind === "logo" ? "size-24" : "aspect-[16/6] w-full max-w-md"
            }`}
          >
            <Image src={mediaUrl(imageKey, previewWidth)} alt={`${label} actuel`} fill sizes="448px" unoptimized className={kind === "logo" ? "object-contain p-2" : "object-cover"} />
            {isPending && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Loader2 className="size-5 animate-spin" aria-label="Traitement en cours" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {picker.input}
            <Button type="button" variant="outline" size="sm" onClick={picker.open} disabled={isPending}>
              <RefreshCw className="size-3.5" aria-hidden />
              Remplacer
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => run(() => removeStoreImage(kind))} disabled={isPending} className="text-destructive hover:text-destructive">
              <Trash2 className="size-3.5" aria-hidden />
              Retirer
            </Button>
          </div>
        </div>
      ) : (
        <ImageDropzone
          label={`Ajouter ${kind === "logo" ? "un logo" : "une image"}`}
          hint={hint}
          pending={isPending}
          onFile={upload}
          className={kind === "logo" ? "h-28 max-w-xs" : "aspect-[16/6] max-w-md"}
        />
      )}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
