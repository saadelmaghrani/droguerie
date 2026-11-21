import type { Metadata } from "next";
import { Suspense } from "react";
import { ComingSoon, ComingSoonSkeleton } from "../_components/coming-soon";
import { PageHeader } from "../_components/page-header";

export const metadata: Metadata = { title: "WhatsApp" };

export default function Page() {
  return (
    <>
      <PageHeader title="WhatsApp" description="Numéros vers lesquels les clients sont redirigés." />
      <Suspense fallback={<ComingSoonSkeleton />}>
        <ComingSoon
          planned="semaine 2"
          features={[
            "Ajouter, modifier et supprimer des numéros",
            "Numéro par défaut du magasin",
            "Activation / désactivation",
          ]}
        />
      </Suspense>
    </>
  );
}
