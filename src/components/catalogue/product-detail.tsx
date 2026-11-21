// Fiche produit du site public. Utilisée aussi par l'aperçu admin (/admin/produits/<id>/apercu)
// pour que l'aperçu soit exactement ce que verra le client. Aucun prix (cahier des charges).
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { whatsappUrl } from "@/lib/phone";
import { productWhatsappMessage } from "@/lib/product-visibility";
import type { ProductDetailData } from "@/server/products/preview";
import { WhatsappIcon } from "@/components/site/whatsapp-icon";
import { ProductGallery } from "./product-gallery";

export function ProductDetail({
  product,
  preview = false,
  productUrl = null,
}: {
  product: ProductDetailData;
  preview?: boolean;
  /** Adresse complète de la fiche, ajoutée au message WhatsApp (null si SITE_URL n'est pas configurée). */
  productUrl?: string | null;
}) {
  // Dans l'aperçu, les pages catégorie / accueil du site n'existent pas forcément : pas de liens.
  const waHref = product.whatsappPhone
    ? whatsappUrl(product.whatsappPhone, productWhatsappMessage(product.name, product.reference, productUrl))
    : null;
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
        <ProductGallery images={product.images} productName={product.name} placeholderIcon={product.category.icon} />

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
                href={waHref!}
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

      {/* Mobile : bouton WhatsApp toujours visible en bas de l'écran (pas dans l'aperçu admin). */}
      {waHref && !preview && (
        <>
          <div className="h-20 lg:hidden" aria-hidden />
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              data-sticky-whatsapp
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 font-semibold text-slate-900 shadow-sm active:bg-[#1ebe5b]"
            >
              <WhatsappIcon className="size-5 shrink-0" />
              <span className="truncate">Demander le prix sur WhatsApp</span>
            </a>
          </div>
        </>
      )}
    </article>
  );
}
