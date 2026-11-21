"use client";

// Galerie de la fiche produit : grande photo + vignettes cliquables (3 photos maximum).
import { useState } from "react";
import { ImageOff } from "lucide-react";
import { mediaSrcSet, mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

type GalleryImage = { id: string; storageKey: string; width: number; height: number };

export function ProductGallery({ images, productName }: { images: GalleryImage[]; productName: string }) {
  const [selectedId, setSelectedId] = useState(images[0]?.id);
  const selected = images.find((i) => i.id === selectedId) ?? images[0];

  if (!selected) {
    return (
      <div className="flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl bg-slate-100 text-slate-400">
        <ImageOff className="size-10" aria-hidden />
        <span className="text-sm">Photo bientôt disponible</span>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        {/* <img> natif : srcset des tailles déjà générées en WebP (320 / 800 / 1600). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={selected.id}
          src={mediaUrl(selected.storageKey, 800)}
          srcSet={mediaSrcSet(selected.storageKey, "product")}
          sizes="(min-width: 1024px) 560px, 100vw"
          width={selected.width}
          height={selected.height}
          alt={productName}
          fetchPriority="high"
          className="absolute inset-0 size-full object-contain"
        />
      </div>
      {images.length > 1 && (
        <ul className="flex gap-3" aria-label="Autres photos">
          {images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setSelectedId(image.id)}
                aria-label={`Voir la photo ${index + 1}`}
                aria-pressed={image.id === selected.id}
                className={cn(
                  "relative block size-20 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900",
                  image.id === selected.id ? "ring-2 ring-slate-900" : "opacity-70 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrl(image.storageKey, 320)}
                  alt=""
                  width={image.width}
                  height={image.height}
                  loading="lazy"
                  className="absolute inset-0 size-full object-contain"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
