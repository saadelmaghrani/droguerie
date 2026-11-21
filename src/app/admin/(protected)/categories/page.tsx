import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/server/auth/dal";
import { listCategories, listWhatsappOptions } from "@/server/categories/service";
import { PageHeader } from "../_components/page-header";
import { CategoriesManager } from "./_components/categories-manager";

export const metadata: Metadata = { title: "Catégories" };

async function CategoriesContent() {
  await requireAdmin(); // 1. vérification de la session, AVANT la lecture des données
  const [categories, whatsappOptions] = await Promise.all([listCategories(), listWhatsappOptions()]);
  return <CategoriesManager categories={categories} whatsappOptions={whatsappOptions} />;
}

function CategoriesSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden>
      <Skeleton className="h-[74px] rounded-xl" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <>
      <PageHeader
        title="Catégories"
        description="Organisez le catalogue et choisissez le numéro WhatsApp de chaque catégorie."
      />
      <Suspense fallback={<CategoriesSkeleton />}>
        <CategoriesContent />
      </Suspense>
    </>
  );
}
