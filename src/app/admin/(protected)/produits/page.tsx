import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, ComingSoonSkeleton } from "../_components/coming-soon";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "Produits" };

export default function Page() {
  return (
    <>
      <PageHeader title="Produits" description="Gérez le catalogue : fiches, photos, publication." />
      <Suspense fallback={<ComingSoonSkeleton />}>
        <ComingSoon
          planned="semaine 3"
          features={[
            "Liste avec recherche et filtres par catégorie / statut",
            "Création et modification des fiches (nom, description, référence, marque)",
            "Jusqu'à 3 photos par produit",
            "Brouillon, publication, désactivation et aperçu",
            "Import CSV",
          ]}
        />
      </Suspense>
    </>
  );
}
