// Aperçu d'un produit tel qu'il apparaîtra sur le site, quel que soit son statut.
// Affiche les données ENREGISTRÉES (pas les modifications en cours dans le formulaire).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductDetail } from "@/components/catalogue/product-detail";
import { productVisibilityIssues } from "@/lib/product-visibility";
import { requireAdmin } from "@/server/auth/dal";
import { getProductDetail } from "@/server/products/preview";
import { getStoreSettings } from "@/server/settings/service";
import { StatusBadge } from "../../_components/status-badge";
import { PreviewToolbar } from "./preview-toolbar";

export const metadata: Metadata = { title: "Aperçu du produit" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function PreviewContent({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin(); // 1. vérification de la session, AVANT la lecture des données
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [product, settings] = await Promise.all([getProductDetail(id), getStoreSettings()]);
  if (!product) notFound();

  const issues = productVisibilityIssues({
    status: product.status,
    categoryName: product.category.name,
    categoryActive: product.category.isActive,
    imageCount: product.images.length,
    hasWhatsapp: product.whatsappPhone !== null,
    hasDescription: Boolean(product.description?.trim()),
  });

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/admin/produits" className="hover:text-foreground hover:underline">Produits</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <Link href={`/admin/produits/${product.id}`} className="truncate hover:text-foreground hover:underline">{product.name}</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-foreground" aria-current="page">Aperçu</span>
      </nav>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Aperçu</h1>
        <StatusBadge status={product.status} />
      </div>

      <PreviewToolbar productId={product.id} status={product.status} issues={issues} />

      {/* Cadre « navigateur » : la fiche telle que le client la verra. */}
      <div className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b bg-slate-100 px-4 py-2 text-xs text-slate-500">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-slate-300" />
            <span className="size-2.5 rounded-full bg-slate-300" />
            <span className="size-2.5 rounded-full bg-slate-300" />
          </span>
          <span className="truncate rounded-md bg-white px-2 py-0.5 font-mono">/produits/{product.slug}</span>
        </div>
        <div className="border-b px-4 py-3 sm:px-6">
          <span className="font-semibold" style={{ color: settings.primaryColor }}>{settings.storeName}</span>
        </div>
        <ProductDetail product={product} preview />
      </div>
    </>
  );
}

export default function ProductPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem] rounded-xl" />}>
      <PreviewContent params={params} />
    </Suspense>
  );
}
