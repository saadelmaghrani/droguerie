"use client";

// Zone d'envoi d'image : clic ou glisser-déposer. Vérification rapide côté navigateur
// (taille, type) pour éviter un envoi inutile ; le serveur revérifie TOUT (vrai format, etc.).
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2 } from "lucide-react";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/media";
import { cn } from "@/lib/utils";

export function checkImageFile(file: File): string | null {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return "Ce fichier n'est pas une photo (JPEG, PNG ou WebP).";
  if (file.size > MAX_UPLOAD_BYTES) {
    return `Fichier trop lourd (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum : ${MAX_UPLOAD_BYTES / 1024 / 1024} Mo.`;
  }
  return null;
}

/** Ouvre le sélecteur de fichiers et appelle onFile avec une image valide. */
export function useImagePicker(onFile: (file: File) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handle = (file: File | undefined) => {
    if (!file) return;
    const error = checkImageFile(file);
    if (error) toast.error(error);
    else onFile(file);
  };
  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPTED_IMAGE_TYPES}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        handle(e.target.files?.[0]);
        e.target.value = ""; // permet de renvoyer le même fichier
      }}
    />
  );
  return { open: () => inputRef.current?.click(), handle, input };
}

export function ImageDropzone({
  label,
  hint,
  pending,
  disabled,
  onFile,
  className,
}: {
  label: string;
  hint?: string;
  pending: boolean;
  disabled?: boolean;
  onFile: (file: File) => void;
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const picker = useImagePicker(onFile);
  const inactive = pending || disabled;

  return (
    // Le champ fichier est À CÔTÉ du bouton (un élément interactif dans un <button> est du HTML invalide).
    <div data-slot="image-dropzone" className="contents">
    {picker.input}
    <button
      type="button" // ne soumet jamais le formulaire englobant
      onClick={picker.open}
      disabled={inactive}
      onDragOver={(e) => {
        e.preventDefault();
        if (!inactive) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!inactive) picker.handle(e.dataTransfer.files?.[0]);
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center text-sm text-muted-foreground transition-colors",
        "hover:border-ring hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
        dragging && "border-primary bg-primary/5",
        className,
      )}
    >
      {pending ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <ImagePlus className="size-6" aria-hidden />}
      <span className="font-medium text-foreground">{pending ? "Envoi et traitement…" : label}</span>
      {hint && !pending && <span className="text-xs">{hint}</span>}
    </button>
    </div>
  );
}
