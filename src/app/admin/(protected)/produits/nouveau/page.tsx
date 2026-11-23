import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { isAiConfigured, isAiFeatureEnabled } from "@/server/ai/client";
import { requireAdmin } from "@/server/auth/dal";
import { listCategoryOptions } from "@/server/products/service";
import { PageHeader } from "../../_components/page-header";
import { ProductForm } from "../_components/product-form";

export const metadata: Metadata = { title: "Nouveau produit" };

async function NewProductContent() {
  await requireAdmin();
  const categories = await listCategoryOptions();
  return <ProductForm product={null} categories={categories} aiEnabled={isAiFeatureEnabled()} aiConfigured={isAiConfigured()} />;
}

export default function NewProductPage() {
  return (
    <>
      <PageHeader title="Nouveau produit" description="Le produit est publié dès sa création (photo principale obligatoire). Choisissez « Brouillon » pour le préparer sans le montrer." />
      <Suspense fallback={<Skeleton className="h-[32rem] rounded-xl" />}>
        <NewProductContent />
      </Suspense>
    </>
  );
}
