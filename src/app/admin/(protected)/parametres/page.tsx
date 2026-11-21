import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, ComingSoonSkeleton } from "../_components/coming-soon";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "Paramètres" };

export default function Page() {
  return (
    <>
      <PageHeader title="Paramètres" description="Informations du magasin et apparence du site." />
      <Suspense fallback={<ComingSoonSkeleton />}>
        <ComingSoon
          planned="semaine 2"
          features={[
            "Nom, logo et couleur principale",
            "Bannière d'accueil",
            "Présentation, adresse, horaires, carte Google Maps",
            "Référencement (SEO)",
          ]}
        />
      </Suspense>
    </>
  );
}
