"use client";

// Contenu commun des pages d'erreur (site public et administration) : message clair + « Réessayer ».
// Le détail technique n'est jamais montré au visiteur ; il est écrit dans la console du navigateur
// (et l'identifiant « digest » permet de retrouver l'erreur dans les journaux du serveur).
import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

export function ErrorState({ error, retry, homeHref, homeLabel }: { error: unknown; retry: () => void; homeHref: string; homeLabel: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: string }).digest ?? "") : "";
  return (
    <div role="alert" className="mx-auto grid max-w-md justify-items-center gap-4 px-4 py-16 text-center">
      <TriangleAlert className="size-10 text-amber-500" aria-hidden />
      <h1 className="text-2xl font-semibold tracking-tight">Un problème est survenu</h1>
      <p className="text-sm text-muted-foreground">
        La page n&apos;a pas pu s&apos;afficher. Réessayez dans un instant ; si le problème persiste, contactez le responsable du site.
      </p>
      <div className="flex flex-wrap justify-center gap-3 text-sm font-medium">
        <button type="button" onClick={() => retry()} className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-5 text-background hover:opacity-90">
          <RotateCcw className="size-4" aria-hidden />
          Réessayer
        </button>
        <Link href={homeHref} className="inline-flex h-10 items-center rounded-full border px-5 hover:bg-muted">{homeLabel}</Link>
      </div>
      {digest && <p className="text-xs text-muted-foreground">Code de l&apos;erreur : {digest}</p>}
    </div>
  );
}
