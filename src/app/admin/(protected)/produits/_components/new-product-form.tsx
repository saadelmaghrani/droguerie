"use client";

// Formulaire « Nouveau produit » qui démarre TOUJOURS à zéro.
//
// Avec cacheComponents, Next.js ne détruit pas une page quittée : il la cache (<Activity>) avec tout son
// état React (champs, résultat d'enregistrement, photos choisies, proposition IA…) et la ré-affiche au
// retour. Pour une création, c'était faux : on retrouvait le produit précédent, et l'effet « après
// création » se relançait (photos renvoyées sur l'ancien produit, redirection vers sa fiche).
//
// Le formulaire est donc remonté à neuf (nouvelle `key`) :
// - à chaque arrivée par un lien ou une redirection (router.bfcacheId change à chaque push / replace) ;
// - dès qu'il est caché après une création réussie (même pour un retour arrière du navigateur).
// Une saisie NON enregistrée reste retrouvée par le bouton « Précédent » du navigateur, comme sur tout site.
// La fiche d'un produit existant (édition) n'utilise pas ce composant : son comportement est inchangé.
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { ProductForm } from "./product-form";

type Props = Omit<ComponentProps<typeof ProductForm>, "product" | "onCreated">;

export function NewProductForm(props: Props) {
  const { bfcacheId } = useRouter();
  const [generation, setGeneration] = useState(0);
  const created = useRef(false);

  // Cleanup exécuté quand la page est cachée (navigation) : après une création, on repart de zéro.
  useLayoutEffect(
    () => () => {
      if (!created.current) return;
      created.current = false;
      setGeneration((g) => g + 1);
    },
    [],
  );

  return <ProductForm key={`${bfcacheId}:${generation}`} {...props} product={null} onCreated={() => (created.current = true)} />;
}
