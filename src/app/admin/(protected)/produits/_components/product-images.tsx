"use client";

// Les 3 emplacements photo d'un produit : 1 = principale, 2 et 3 = secondaires.
import Image from "next/image";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2, RefreshCw, Star, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mediaUrl } from "@/lib/media";
import {
  moveProductImage,
  removeProductImage,
  replaceProductImageFile,
  setPrimaryProductImage,
  uploadProductImage,
} from "@/server/products/image-actions";
import { ImageDropzone, useImagePicker } from "../../_components/image-dropzone";

export type ProductImage = { id: string; position: number; storageKey: string; width: number; height: number };
type Result = { ok: boolean; message: string };

const SLOTS = [0, 1, 2] as const;

export function ProductImages({ productId, productName, images }: { productId: string; productName: string; images: ProductImage[] }) {
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null); // "upload" ou id de la photo
  const [toDelete, setToDelete] = useState<ProductImage | null>(null);
  const byPosition = new Map(images.map((i) => [i.position, i]));
  const firstFree = SLOTS.find((p) => !byPosition.has(p));

  function run(tag: string, action: () => Promise<Result>, after?: () => void) {
    setBusy(tag);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
        after?.();
      } catch {
        toast.error("Envoi impossible. Vérifiez la connexion et réessayez.");
      } finally {
        setBusy(null);
      }
    });
  }

  const withFile = (file: File) => {
    const data = new FormData();
    data.set("file", file);
    return data;
  };

  return (
    <div className="grid gap-3">
      <ul className="grid gap-3 sm:grid-cols-3" aria-label="Photos du produit">
        {SLOTS.map((position) => {
          const image = byPosition.get(position);
          return (
            <li key={position} className="grid gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {position === 0 ? "Photo principale" : `Photo ${position + 1}`}
              </span>
              {image ? (
                <FilledSlot
                  image={image}
                  productName={productName}
                  busy={isPending && busy === image.id}
                  disabled={isPending}
                  onReplace={(file) => run(image.id, () => replaceProductImageFile(image.id, withFile(file)))}
                  onPrimary={() => run(image.id, () => setPrimaryProductImage(image.id))}
                  onMove={(direction) => run(image.id, () => moveProductImage(image.id, direction))}
                  onDelete={() => setToDelete(image)}
                  canMoveLeft={position > 0}
                  canMoveRight={byPosition.has(position + 1)}
                />
              ) : position === firstFree ? (
                <ImageDropzone
                  label="Ajouter une photo"
                  hint="Glissez-déposez ou cliquez · JPEG, PNG, WebP · 8 Mo max"
                  pending={isPending && busy === "upload"}
                  disabled={isPending}
                  onFile={(file) => run("upload", () => uploadProductImage(productId, withFile(file)))}
                  className="aspect-square"
                />
              ) : (
                <div className="aspect-square rounded-lg border border-dashed bg-muted/20" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        La photo principale apparaît dans le catalogue. Les métadonnées (dont la position GPS) sont supprimées à l&apos;envoi.
      </p>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && !isPending && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette photo ?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.position === 0 && images.length > 1
                ? "C'est la photo principale : la photo suivante la remplacera. "
                : ""}
              Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={() => toDelete && run(toDelete.id, () => removeProductImage(toDelete.id), () => setToDelete(null))}
            >
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Supprimer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FilledSlot({
  image,
  productName,
  busy,
  disabled,
  onReplace,
  onPrimary,
  onMove,
  onDelete,
  canMoveLeft,
  canMoveRight,
}: {
  image: ProductImage;
  productName: string;
  busy: boolean;
  disabled: boolean;
  onReplace: (file: File) => void;
  onPrimary: () => void;
  onMove: (direction: "left" | "right") => void;
  onDelete: () => void;
  canMoveLeft: boolean;
  canMoveRight: boolean;
}) {
  const picker = useImagePicker(onReplace);
  const position = image.position + 1;

  return (
    <div className="grid gap-2">
      <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted/30">
        <Image
          src={mediaUrl(image.storageKey, 800)}
          alt={`${productName} — photo ${position}`}
          fill
          sizes="(min-width: 640px) 240px, 100vw"
          unoptimized // tailles déjà générées en WebP par le serveur (320 / 800 / 1600)
          className="object-contain"
        />
        {image.position === 0 && (
          <Badge className="absolute top-2 left-2">
            <Star className="size-3" aria-hidden />
            Principale
          </Badge>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Traitement en cours" />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {picker.input}
        <Button type="button" variant="ghost" size="icon-sm" disabled={disabled || !canMoveLeft} onClick={() => onMove("left")} aria-label={`Déplacer la photo ${position} vers la gauche`}>
          <ArrowLeft aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={disabled || !canMoveRight} onClick={() => onMove("right")} aria-label={`Déplacer la photo ${position} vers la droite`}>
          <ArrowRight aria-hidden />
        </Button>
        {image.position !== 0 && (
          <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} onClick={onPrimary} aria-label={`Définir la photo ${position} comme principale`} title="Définir comme principale">
            <Star aria-hidden />
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} onClick={picker.open} aria-label={`Remplacer la photo ${position}`} title="Remplacer">
          <RefreshCw aria-hidden />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} onClick={onDelete} aria-label={`Supprimer la photo ${position}`} title="Supprimer" className="ml-auto text-destructive hover:text-destructive">
          <Trash2 aria-hidden />
        </Button>
      </div>
    </div>
  );
}
