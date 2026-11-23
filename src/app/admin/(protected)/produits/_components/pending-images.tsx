"use client";

// Photos choisies AVANT la création du produit (fiche « Nouveau produit »).
// Chaque photo est montrée telle qu'elle sera publiée : aperçu « fond blanc » calculé par le serveur
// (détourage, un seul article, 12 % de marge) — rien n'est enregistré à ce stade. Les fichiers d'origine
// restent dans le navigateur ; product-form.tsx les envoie après la création (même traitement).
import { useEffect, useRef } from "react";
import { Loader2, Star, Wand2, X } from "lucide-react";
import { previewStudioPhoto } from "@/server/products/image-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageDropzone } from "../../_components/image-dropzone";

export type PendingImage = {
  id: string;
  file: File;
  /** Aperçu local de la photo d'origine (blob:). */
  previewUrl: string;
  /** Aperçu fond blanc calculé par le serveur ; undefined = en cours ; null = gardée telle quelle. */
  studioUrl?: string | null;
  notice?: string;
};

const MAX = 3;

export function PendingImages({
  images,
  onChange,
  disabled,
  productName = "",
}: {
  images: PendingImage[];
  onChange: (images: PendingImage[] | ((current: PendingImage[]) => PendingImage[])) => void;
  disabled: boolean;
  /** Nom saisi : sert à reconnaître un lot / pack (tous les articles gardés). */
  productName?: string;
}) {
  // Libère les aperçus (URL locales) quand on quitte la page.
  const latest = useRef(images);
  useEffect(() => {
    latest.current = images;
  }, [images]);
  useEffect(() => () => latest.current.forEach((i) => URL.revokeObjectURL(i.previewUrl)), []);

  const add = async (file: File) => {
    const id = crypto.randomUUID();
    onChange((current) => [...current, { id, file, previewUrl: URL.createObjectURL(file) }].slice(0, MAX));
    const data = new FormData();
    data.set("file", file);
    data.set("name", productName);
    let update: Partial<PendingImage>;
    try {
      const result = await previewStudioPhoto(data);
      update = result.ok ? { studioUrl: result.dataUrl, notice: result.notice } : { studioUrl: null, notice: result.error };
    } catch {
      update = { studioUrl: null, notice: "Aperçu indisponible : le fond blanc sera appliqué à la création." };
    }
    onChange((current) => current.map((i) => (i.id === id ? { ...i, ...update } : i)));
  };
  const remove = (image: PendingImage) => {
    URL.revokeObjectURL(image.previewUrl);
    onChange(images.filter((i) => i.id !== image.id));
  };

  return (
    <div className="grid gap-3">
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image, index) => (
          <li key={image.id} className="relative aspect-square overflow-hidden rounded-lg border bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:), non optimisable */}
            <img
              src={image.studioUrl ?? image.previewUrl}
              alt={`Photo ${index + 1} : ${image.file.name}`}
              className="absolute inset-0 size-full object-contain"
            />
            {image.studioUrl === undefined && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 text-xs text-muted-foreground">
                <Loader2 className="size-6 animate-spin" aria-hidden />
                Détourage…
              </div>
            )}
            {image.studioUrl && (
              <Badge variant="secondary" className="absolute right-2 bottom-2">
                <Wand2 className="size-3" aria-hidden />
                Fond blanc auto
              </Badge>
            )}
            {image.studioUrl === null && image.notice && (
              <p className="absolute inset-x-2 bottom-2 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">{image.notice}</p>
            )}
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
              onFile={(file) => void add(file)}
              className="aspect-square w-full"
            />
          </li>
        )}
      </ul>
      <p className="text-xs text-muted-foreground">
        Jusqu&apos;à {MAX} photos. La première est la photo principale. Aperçu tel que publié (fond blanc automatique) ;
        la photo d&apos;origine est conservée et récupérable depuis la fiche.
      </p>
    </div>
  );
}
