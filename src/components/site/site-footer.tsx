// Pied de page : coordonnées, horaires, réseaux sociaux, contact WhatsApp.
// Un champ vide dans les Paramètres = information masquée.
import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { formatPhone, whatsappUrl } from "@/lib/phone";
import type { PublicCategory, PublicSettings } from "@/server/catalogue/queries";
import { WhatsappIcon } from "./whatsapp-icon";

const SOCIAL_LABELS = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok" } as const;

export function SiteFooter({ settings, categories }: { settings: PublicSettings; categories: PublicCategory[] }) {
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
            <ul className="grid gap-1.5 text-sm">
              {categories.map((c) => (
                <li key={c.id}><Link href={`/categories/${c.slug}`} className="text-slate-600 hover:text-slate-900 hover:underline">{c.name}</Link></li>
              ))}
            </ul>
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
