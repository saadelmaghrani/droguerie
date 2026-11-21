import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, ComingSoonSkeleton } from "../_components/coming-soon";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "Statistiques" };

export default function Page() {
  return (
    <>
      <PageHeader title="Statistiques" description="Visites, consultations et clics WhatsApp." />
      <Suspense fallback={<ComingSoonSkeleton />}>
        <ComingSoon
          planned="semaine 5"
          features={[
            "Visiteurs et visites",
            "Produits et catégories les plus consultés",
            "Clics WhatsApp",
            "Graphiques par période",
          ]}
        />
      </Suspense>
    </>
  );
}
