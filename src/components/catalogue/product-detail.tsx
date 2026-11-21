// Fiche produit du site public. Utilisée aussi par l'aperçu admin (/admin/produits/<id>/apercu)
// pour que l'aperçu soit exactement ce que verra le client. Aucun prix (cahier des charges).
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { whatsappUrl } from "@/lib/phone";
import { productWhatsappMessage } from "@/lib/product-visibility";
import type { ProductDetailData } from "@/server/products/preview";
import { ProductGallery } from "./product-gallery";

function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.9-4.45 9.9-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.03c-.24.68-1.42 1.3-1.95 1.34-.5.05-.97.23-3.27-.68-2.77-1.09-4.52-3.92-4.66-4.1-.13-.18-1.11-1.48-1.11-2.82 0-1.34.7-2 .95-2.28.25-.27.54-.34.72-.34l.52.01c.17 0 .39-.06.61.47.23.54.77 1.88.84 2.02.07.13.11.29.02.47-.09.18-.13.29-.27.45l-.4.47c-.13.13-.27.28-.12.55.16.27.7 1.15 1.5 1.86 1.03.92 1.9 1.2 2.17 1.34.27.13.43.11.58-.07.16-.18.68-.79.86-1.06.18-.27.36-.23.61-.14.25.09 1.58.75 1.85.88.27.14.45.2.52.32.07.11.07.66-.17 1.33Z" />
    </svg>
  );
}

export function ProductDetail({ product, preview = false }: { product: ProductDetailData; preview?: boolean }) {
  // Dans l'aperçu, les pages catégorie / accueil du site n'existent pas forcément : pas de liens.
  const crumb = (href: string, label: string) =>
    preview ? <span>{label}</span> : <Link href={href} className="hover:text-slate-900 hover:underline">{label}</Link>;

  return (
    <article className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      <nav aria-label="Fil d'Ariane" className="mb-6 flex flex-wrap items-center gap-1 text-sm text-slate-500">
        {crumb("/", "Accueil")}
        <ChevronRight className="size-3.5" aria-hidden />
        {crumb(`/categories/${product.category.slug}`, product.category.name)}
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="truncate text-slate-900" aria-current="page">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} productName={product.name} />

        <div className="grid content-start gap-5">
          <div className="grid gap-2">
            {product.brand && <p className="text-sm font-medium uppercase tracking-wide text-slate-500">{product.brand}</p>}
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 text-balance sm:text-3xl">{product.name}</h1>
            {product.reference && <p className="text-sm text-slate-500">Réf. {product.reference}</p>}
          </div>

          <div className="grid gap-2 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <p className="text-sm text-slate-600">
              Prix et disponibilité sur demande : contactez-nous directement sur WhatsApp.
            </p>
            {product.whatsappPhone ? (
              <a
                href={whatsappUrl(product.whatsappPhone, productWhatsappMessage(product.name, product.reference))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-2 text-center font-semibold text-slate-900 shadow-sm transition hover:bg-[#1ebe5b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              >
                <WhatsappIcon className="size-5" />
                Demander le prix sur WhatsApp
              </a>
            ) : (
              <p className="text-sm text-slate-500">Contact WhatsApp momentanément indisponible.</p>
            )}
          </div>

          {product.description && (
            <section className="grid gap-2">
              <h2 className="text-base font-semibold text-slate-900">Description</h2>
              <p className="whitespace-pre-line leading-relaxed text-slate-700">{product.description}</p>
            </section>
          )}
        </div>
      </div>
    </article>
  );
}
