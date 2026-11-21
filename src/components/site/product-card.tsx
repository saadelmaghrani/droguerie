// Carte produit du catalogue (accueil, catalogue, catégories). Aucun prix (cahier des charges).
import Link from "next/link";
import { ProductPlaceholder } from "@/components/catalogue/product-placeholder";
import { mediaSrcSet, mediaUrl } from "@/lib/media";
import type { ProductCardData } from "@/server/catalogue/queries";

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  return (
    <Link
      href={`/produits/${product.slug}`}
      className="group grid content-start gap-2 rounded-2xl bg-white p-2 ring-1 ring-slate-200 transition hover:shadow-md hover:ring-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-white">
        {product.image ? (
          // <img> natif : tailles WebP déjà générées (320 / 800 / 1600), le navigateur choisit.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(product.image.key, 320)}
            srcSet={mediaSrcSet(product.image.key, "product")}
            sizes="(min-width: 1024px) 260px, (min-width: 640px) 30vw, 46vw"
            width={product.image.width}
            height={product.image.height}
            alt=""
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            className="absolute inset-0 size-full object-contain transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <ProductPlaceholder icon={product.categoryIcon} className="absolute inset-0" />
        )}
      </div>
      <div className="grid gap-0.5 px-1 pb-1">
        {product.brand && <span className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{product.brand}</span>}
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-slate-900">{product.name}</h3>
      </div>
    </Link>
  );
}

export function ProductGrid({ products, priorityCount = 0 }: { products: ProductCardData[]; priorityCount?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
