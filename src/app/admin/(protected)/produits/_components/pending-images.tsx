"use client";

// Photos choisies AVANT la création du produit (fiche « Nouveau produit ») — mode MANUEL :
// chaque photo est montrée et sera enregistrée telle qu'envoyée (aucun fond blanc, aucune IA).
// Les fichiers restent dans le navigateur ; product-form.tsx les envoie dans cet ordre juste après
// la création (la 1re devient la photo principale).
import { useEffect, useRef } from "react";
import { RefreshCw, Star, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageDropzone, useImagePicker } from "../../_components/image-dropzone";

export type PendingImage = { id: string; file: File; previewUrl: string };

const MAX = 3;

function PendingSlot({
  image,
  index,
  disabled,
  onPrimary,
  onReplace,
  onRemove,
}: {
  image: PendingImage;
  index: number;
  disabled: boolean;
  onPrimary: () => void;
  onReplace: (file: File) => void;
  onRemove: () => void;
}) {
  const picker = useImagePicker(onReplace);
  const position = index + 1;
  return (
    <li className="grid min-w-0 content-start gap-2">
      <div className="relative aspect-square overflow-hidden rounded-lg border bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:), non optimisable */}
        <img src={image.previewUrl} alt={`Photo ${position} : ${image.file.name}`} className="absolute inset-0 size-full object-contain" />
        {index === 0 && (
          <Badge className="absolute left-2 top-2 gap-1">
            <Star className="size-3" aria-hidden />
            Principale
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {picker.input}
        <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} onClick={picker.open} aria-label={`Remplacer la photo ${position}`} title="Remplacer">
          <RefreshCw aria-hidden />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={disabled}
          onClick={onRemove}
          aria-label={`Retirer la photo ${position}`}
          title="Retirer"
          className="ml-auto text-destructive hover:text-destructive"
        >
          <X aria-hidden />
        </Button>
      </div>
      {index > 0 && (
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onPrimary} className="h-auto justify-start py-1.5 text-left whitespace-normal">
          <Star aria-hidden />
          Définir comme principale
        </Button>
      )}
    </li>
  );
}

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
  const replace = (image: PendingImage, file: File) => {
    URL.revokeObjectURL(image.previewUrl);
    onChange(images.map((i) => (i.id === image.id ? { id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) } : i)));
  };
  // La photo choisie passe en 1re position ; les autres gardent leur ordre.
  const makePrimary = (image: PendingImage) => onChange([image, ...images.filter((i) => i.id !== image.id)]);

  return (
    <div className="grid gap-3">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image, index) => (
          <PendingSlot
            key={image.id}
            image={image}
            index={index}
            disabled={disabled}
            onPrimary={() => makePrimary(image)}
            onReplace={(file) => replace(image, file)}
            onRemove={() => remove(image)}
          />
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
        Jusqu&apos;à {MAX} photos, enregistrées telles que vous les envoyez. La première est la photo principale (affichée dans le
        catalogue) : utilisez « Définir comme principale » pour en choisir une autre.
      </p>
    </div>
  );
}
