import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { isAiConfigured } from "@/server/ai/client";
import { requireAdmin } from "@/server/auth/dal";
import { getProduct, listCategoryOptions } from "@/server/products/service";
import { StatusBadge } from "../_components/status-badge";
import { ProductForm } from "../_components/product-form";

export const metadata: Metadata = { title: "Modifier le produit" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function EditProductContent({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(); // 1. vérification de la session, AVANT la lecture des données
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [product, categories] = await Promise.all([getProduct(id), listCategoryOptions()]);
  if (!product) notFound();

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/admin/produits" className="hover:text-foreground hover:underline">Produits</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="truncate text-foreground" aria-current="page">{product.name}</span>
      </nav>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
        <StatusBadge status={product.status} />
      </div>
      <ProductForm
        product={{
          id: product.id,
          name: product.name,
          slug: product.slug,
          description: product.description ?? "",
          reference: product.reference ?? "",
          brand: product.brand ?? "",
          categoryId: product.categoryId,
          status: product.status,
          isFeatured: product.isFeatured,
          imageCount: product._count.images,
          images: product.images,
        }}
        categories={categories}
        aiConfigured={isAiConfigured()}
      />
    </>
  );
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem] rounded-xl" />}>
      <EditProductContent params={params} />
    </Suspense>
  );
}
