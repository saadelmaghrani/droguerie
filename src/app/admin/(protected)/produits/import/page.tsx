import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/server/auth/dal";
import { listCategoryOptions } from "@/server/products/service";
import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = { title: "Importer des produits" };

async function ImportContent() {
  await requireAdmin(); // vérification de la session, AVANT la lecture des données
  const categories = await listCategoryOptions();
  return <ImportWizard categoryNames={categories.map((c) => c.name)} />;
}

export default function ImportPage() {
  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-2 flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/admin/produits" className="hover:text-foreground hover:underline">Produits</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="text-foreground" aria-current="page">Importer</span>
      </nav>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Importer des produits</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajoutez ou mettez à jour de nombreux produits en une fois depuis un fichier CSV (Excel).
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-80 rounded-xl" />}>
        <ImportContent />
      </Suspense>
    </>
  );
}
