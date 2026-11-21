// Paramètres du magasin : une seule ligne (id = 1) dans store_settings.
import "server-only";

import { prisma } from "@/lib/prisma";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/color";
import { formatPhone } from "@/lib/phone";
import type { SocialNetwork } from "@/lib/external-links";

export type SocialLinks = Partial<Record<SocialNetwork, string>>;

/** Données enregistrées (null = champ vide → bloc masqué sur le site). */
export type StoreSettingsData = {
  storeName: string;
  primaryColor: string;
  heroTitle: string | null;
  heroSubtitle: string | null;
  heroCtaLabel: string | null;
  aboutText: string | null;
  address: string | null;
  openingHours: string | null;
  phone: string | null;
  email: string | null;
  mapsEmbedUrl: string | null;
  socialLinks: SocialLinks;
  seoTitle: string | null;
  seoDescription: string | null;
  showFeatured: boolean;
  showNewArrivals: boolean;
};

/** Valeurs affichées dans le formulaire (chaînes vides au lieu de null). */
export type StoreSettingsFormValues = {
  [K in Exclude<keyof StoreSettingsData, "socialLinks" | "showFeatured" | "showNewArrivals">]: string;
} & { facebook: string; instagram: string; tiktok: string; showFeatured: boolean; showNewArrivals: boolean };

const SINGLETON_ID = 1;

/** Lit les paramètres ; crée la ligne avec des valeurs neutres si elle n'existe pas encore. */
export async function getStoreSettings(): Promise<StoreSettingsData & { updatedAt: Date }> {
  const row = await prisma.storeSettings.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID, storeName: "Droguerie", primaryColor: DEFAULT_PRIMARY_COLOR },
  });
  const social = (row.socialLinks ?? {}) as SocialLinks;
  return {
    storeName: row.storeName,
    primaryColor: row.primaryColor,
    heroTitle: row.heroTitle,
    heroSubtitle: row.heroSubtitle,
    heroCtaLabel: row.heroCtaLabel,
    aboutText: row.aboutText,
    address: row.address,
    openingHours: row.openingHours,
    phone: row.phone,
    email: row.email,
    mapsEmbedUrl: row.mapsEmbedUrl,
    socialLinks: { facebook: social.facebook, instagram: social.instagram, tiktok: social.tiktok },
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    showFeatured: row.showFeatured,
    showNewArrivals: row.showNewArrivals,
    updatedAt: row.updatedAt,
  };
}

export function toFormValues(s: StoreSettingsData): StoreSettingsFormValues {
  const text = (v: string | null) => v ?? "";
  return {
    storeName: s.storeName,
    primaryColor: s.primaryColor,
    heroTitle: text(s.heroTitle),
    heroSubtitle: text(s.heroSubtitle),
    heroCtaLabel: text(s.heroCtaLabel),
    aboutText: text(s.aboutText),
    address: text(s.address),
    openingHours: text(s.openingHours),
    phone: s.phone ? formatPhone(s.phone) : "",
    email: text(s.email),
    mapsEmbedUrl: text(s.mapsEmbedUrl),
    facebook: s.socialLinks.facebook ?? "",
    instagram: s.socialLinks.instagram ?? "",
    tiktok: s.socialLinks.tiktok ?? "",
    seoTitle: text(s.seoTitle),
    seoDescription: text(s.seoDescription),
    showFeatured: s.showFeatured,
    showNewArrivals: s.showNewArrivals,
  };
}

export async function updateStoreSettings(data: StoreSettingsData): Promise<void> {
  // Réseaux non renseignés : retirés de l'objet JSON.
  const socialLinks = Object.fromEntries(Object.entries(data.socialLinks).filter(([, url]) => Boolean(url)));
  const values = { ...data, socialLinks };
  await prisma.storeSettings.upsert({
    where: { id: SINGLETON_ID },
    update: values,
    create: { id: SINGLETON_ID, ...values },
  });
}
