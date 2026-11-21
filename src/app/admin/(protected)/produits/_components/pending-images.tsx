"use client";

// Photos choisies AVANT la création du produit (fiche « Nouveau produit »).
// Rien n'est envoyé ici : les fichiers restent dans le navigateur, puis product-form.tsx
// les envoie un par un juste après la création (le serveur les vérifie alors comme d'habitude).
import { useEffect, useRef } from "react";
import { Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageDropzone } from "../../_components/image-dropzone";

export type PendingImage = { id: string; file: File; previewUrl: string };

const MAX = 3;

export function PendingImages({
  images,
  onChange,
  disabled,
}: {
  images: PendingImage[];
  onChange: (images: PendingImage[]) => void;
  disabled: boolean;
}) {
  // Libère les aperçus (URL locales) quand on quitte la page.
  const latest = useRef(images);
  useEffect(() => {
    latest.current = images;
  }, [images]);
  useEffect(() => () => latest.current.forEach((i) => URL.revokeObjectURL(i.previewUrl)), []);

  const add = (file: File) =>
    onChange([...images, { id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }].slice(0, MAX));
  const remove = (image: PendingImage) => {
    URL.revokeObjectURL(image.previewUrl);
    onChange(images.filter((i) => i.id !== image.id));
  };

  return (
    <div className="grid gap-3">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image, index) => (
          <li key={image.id} className="relative aspect-square overflow-hidden rounded-lg border bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:), non optimisable */}
            <img src={image.previewUrl} alt={`Photo ${index + 1} : ${image.file.name}`} className="absolute inset-0 size-full object-contain" />
            {index === 0 && (
              <Badge className="absolute left-2 top-2 gap-1">
                <Star className="size-3" aria-hidden />
                Principale
              </Badge>
            )}
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={() => remove(image)}
              disabled={disabled}
              aria-label={`Retirer la photo ${index + 1}`}
              className="absolute right-2 top-2 size-7 shadow-sm"
            >
              <X className="size-4" aria-hidden />
            </Button>
          </li>
        ))}
        {images.length < MAX && (
          <li>
            <ImageDropzone
              label="Ajouter une photo"
              hint="Glissez-déposez ou cliquez · JPEG, PNG, WebP · 8 Mo max"
              pending={false}
              disabled={disabled}
              onFile={add}
              className="aspect-square w-full"
            />
          </li>
        )}
      </ul>
      <p className="text-xs text-muted-foreground">
        Jusqu&apos;à {MAX} photos. La première est la photo principale. Elles seront envoyées à la création du produit.
      </p>
    </div>
  );
}
