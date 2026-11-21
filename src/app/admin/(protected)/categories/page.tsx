import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, ComingSoonSkeleton } from "../_components/coming-soon";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "Catégories" };

export default function Page() {
  return (
    <>
      <PageHeader title="Catégories" description="Organisez les produits et associez un numéro WhatsApp." />
      <Suspense fallback={<ComingSoonSkeleton />}>
        <ComingSoon
          planned="semaine 2"
          features={[
            "Ajouter, modifier et supprimer des catégories",
            "Ordre d'affichage",
            "Numéro WhatsApp associé à chaque catégorie",
          ]}
        />
      </Suspense>
    </>
  );
}
