// Pied de page : coordonnées, horaires, réseaux sociaux, contact WhatsApp.
// Un champ vide dans les Paramètres = information masquée.
import Link from "next/link";
import { ArrowRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { formatPhone, whatsappUrl } from "@/lib/phone";
import type { PublicCategory, PublicSettings } from "@/server/catalogue/queries";
import { WhatsappIcon } from "./whatsapp-icon";

/** Catégories listées dans le pied de page ; au-delà, un lien « Toutes les catégories » vers le catalogue. */
const FOOTER_CATEGORY_LIMIT = 5;

const SOCIAL_LABELS = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok" } as const;

export function SiteFooter({ settings, categories }: { settings: PublicSettings; categories: PublicCategory[] }) {
  // Peu de catégories (6 ou moins) : toutes affichées, pas de lien « voir tout » qui ne cacherait qu'une ligne.
  const footerCategories = categories.length > FOOTER_CATEGORY_LIMIT + 1 ? categories.slice(0, FOOTER_CATEGORY_LIMIT) : categories;
  const moreCount = categories.length - footerCategories.length;
  const socials = (Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[]).filter((k) => settings.socialLinks[k]);
  return (
    <footer className="mt-16 border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-3">
        <section className="grid content-start gap-3">
          <h2 className="text-base font-semibold text-slate-900">{settings.storeName}</h2>
          <ul className="grid gap-2 text-sm text-slate-600">
            {settings.address && (
              <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /><span className="whitespace-pre-line">{settings.address}</span></li>
            )}
            {settings.openingHours && (
              <li className="flex gap-2"><Clock className="mt-0.5 size-4 shrink-0" aria-hidden /><span className="whitespace-pre-line">{settings.openingHours}</span></li>
            )}
            {settings.phone && (
              <li className="flex gap-2">
                <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
                <a href={`tel:+${settings.phone}`} className="hover:underline">{formatPhone(settings.phone)}</a>
              </li>
            )}
            {settings.email && (
              <li className="flex gap-2">
                <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
                <a href={`mailto:${settings.email}`} className="break-all hover:underline">{settings.email}</a>
              </li>
            )}
          </ul>
        </section>

        {categories.length > 0 && (
          <section className="grid content-start gap-3">
            <h2 className="text-base font-semibold text-slate-900">Catégories</h2>
            {/* Mobile : 2 colonnes (footer moins haut) ; dès 640 px : 1 colonne dans sa propre colonne. */}
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-1 sm:gap-y-1.5">
              {footerCategories.map((c) => (
                <li key={c.id} className="min-w-0">
                  <Link href={`/categories/${c.slug}`} className="block truncate text-slate-600 hover:text-slate-900 hover:underline">{c.name}</Link>
                </li>
              ))}
            </ul>
            {moreCount > 0 && (
              <Link
                href="/produits"
                className="inline-flex w-fit items-center gap-1 text-sm font-medium text-slate-900 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
              >
                Toutes les catégories ({categories.length})
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            )}
          </section>
        )}

        <section className="grid content-start gap-3">
          <h2 className="text-base font-semibold text-slate-900">Nous contacter</h2>
          <p className="text-sm text-slate-600">Prix et disponibilité sur demande, directement sur WhatsApp.</p>
          {settings.defaultWhatsapp && (
            <a
              href={whatsappUrl(settings.defaultWhatsapp, `Bonjour ${settings.storeName}, j'ai une question.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 w-fit items-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-semibold text-slate-900 shadow-sm hover:bg-[#1ebe5b]"
            >
              <WhatsappIcon className="size-5" />
              Écrire sur WhatsApp
            </a>
          )}
          {socials.length > 0 && (
            <ul className="flex flex-wrap gap-2 text-sm">
              {socials.map((k) => (
                <li key={k}>
                  <a href={settings.socialLinks[k]} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-full border border-slate-300 bg-white px-3.5 text-slate-700 hover:border-slate-400">
                    {SOCIAL_LABELS[k]}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="border-t border-slate-200 px-4 py-4 text-center text-xs text-slate-500">{settings.storeName} · Aucun prix affiché : demandez-nous sur WhatsApp.</p>
    </footer>
  );
}
