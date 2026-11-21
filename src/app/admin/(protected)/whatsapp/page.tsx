import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/server/auth/dal";
import { listWhatsappNumbers } from "@/server/whatsapp/service";
import { PageHeader } from "../_components/page-header";
import { WhatsappManager } from "./_components/whatsapp-manager";

export const metadata: Metadata = { title: "WhatsApp" };

async function WhatsappContent() {
  await requireAdmin(); // 1. vérification de la session, AVANT la lecture des données
  const numbers = await listWhatsappNumbers();
  return <WhatsappManager numbers={numbers} />;
}

function WhatsappSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden>
      <Skeleton className="h-[74px] rounded-xl" />
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}

export default function WhatsappPage() {
  return (
    <>
      <PageHeader title="WhatsApp" description="Numéros vers lesquels les clients sont redirigés depuis les produits." />
      <Suspense fallback={<WhatsappSkeleton />}>
        <WhatsappContent />
      </Suspense>
    </>
  );
}
