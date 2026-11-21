// Contenu de la page « introuvable » (produit retiré, adresse erronée…).
import Link from "next/link";
import { SearchX } from "lucide-react";
import { SearchBox } from "./search-box";

export function NotFoundContent() {
  return (
    <div className="mx-auto grid max-w-lg justify-items-center gap-4 px-4 py-16 text-center">
      <SearchX className="size-10 text-slate-400" aria-hidden />
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Page introuvable</h1>
      <p className="text-slate-600">
        Ce produit n&apos;est plus disponible en ligne, ou l&apos;adresse est incorrecte. Cherchez-le dans le catalogue :
      </p>
      <div className="w-full">
        <SearchBox size="lg" />
      </div>
      <div className="flex flex-wrap justify-center gap-3 text-sm font-medium">
        <Link href="/produits" className="rounded-full border border-slate-300 px-4 py-2 hover:border-slate-400">Tout le catalogue</Link>
        <Link href="/" className="rounded-full border border-slate-300 px-4 py-2 hover:border-slate-400">Accueil</Link>
      </div>
    </div>
  );
}
