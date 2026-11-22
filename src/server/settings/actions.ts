"use server";
// Action serveur des paramètres du magasin. Point d'entrée public : requireAdmin() en premier.

import { refresh } from "next/cache";
import { invalidateCatalogue } from "@/server/catalogue/cache";
import { z } from "zod";
import { isHexColor } from "@/lib/color";
import { parsePixelId } from "@/lib/meta-pixel";
import { parseMapsEmbed, parseSocialUrl, type SocialNetwork } from "@/lib/external-links";
import { normalizePhone } from "@/lib/phone";
import { requireAdmin } from "@/server/auth/dal";
import { updateStoreSettings, type StoreSettingsFormValues } from "./service";

type Field = keyof StoreSettingsFormValues;

export type SettingsFormState =
  | { ok: true; message: string; submissionId: number }
  | { ok: false; message: string; fieldErrors: Partial<Record<Field, string>>; submissionId: number }
  | undefined;

/** Texte facultatif : espaces retirés, longueur maximale ; vide → null. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} : ${max} caractères maximum.`)
    .transform((v) => v || null);

const schema = z.object({
  storeName: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(60, "Le nom : 60 caractères maximum."),
  primaryColor: z.string().trim().refine(isHexColor, "Couleur invalide (format #RRGGBB)."),
  heroTitle: optionalText(80, "Titre"),
  heroSubtitle: optionalText(200, "Sous-titre"),
  heroCtaLabel: optionalText(30, "Texte du bouton"),
  aboutText: optionalText(2000, "Présentation"),
  address: optionalText(200, "Adresse"),
  openingHours: optionalText(300, "Horaires"),
  phone: z.string().trim().max(40, "Numéro trop long."),
  email: z.union([z.literal(""), z.string().trim().max(120).pipe(z.email("Adresse email invalide."))]),
  mapsEmbedUrl: z.string().max(4000, "Lien trop long."),
  facebook: z.string().max(400),
  instagram: z.string().max(400),
  tiktok: z.string().max(400),
  seoTitle: optionalText(70, "Titre Google"),
  seoDescription: optionalText(160, "Description Google"),
});

export async function saveStoreSettings(_previous: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requireAdmin();
  const submissionId = Date.now();
  const read = (key: string) => String(formData.get(key) ?? "").slice(0, 5000);

  const parsed = schema.safeParse(Object.fromEntries(Object.keys(schema.shape).map((key) => [key, read(key)])));
  const fieldErrors: Partial<Record<Field, string>> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as Field] ??= issue.message;
  }

  // Validations spécifiques (téléphone, carte, réseaux sociaux).
  const phoneInput = read("phone").trim();
  const phone = phoneInput ? normalizePhone(phoneInput) : null;
  if (phone && !phone.ok) fieldErrors.phone ??= phone.error;

  const mapsInput = read("mapsEmbedUrl").trim();
  const maps = mapsInput ? parseMapsEmbed(mapsInput) : null;
  if (maps && !maps.ok) fieldErrors.mapsEmbedUrl ??= maps.error;

  const pixel = parsePixelId(read("metaPixelId"));
  if (!pixel.ok) fieldErrors.metaPixelId ??= pixel.error;
  const pixelEnabled = formData.get("metaPixelEnabled") === "on";
  if (pixel.ok && pixelEnabled && !pixel.value) fieldErrors.metaPixelId ??= "Renseignez l'identifiant du Pixel, ou désactivez-le.";

  const socialLinks: Partial<Record<SocialNetwork, string>> = {};
  for (const network of ["facebook", "instagram", "tiktok"] as const) {
    const input = read(network).trim();
    if (!input) continue;
    const result = parseSocialUrl(network, input);
    if (result.ok) socialLinks[network] = result.value;
    else fieldErrors[network] ??= result.error;
  }

  if (!parsed.success || Object.keys(fieldErrors).length > 0) {
    return { ok: false, message: "Certains champs sont à corriger.", fieldErrors, submissionId };
  }

  const d = parsed.data;
  await updateStoreSettings({
    storeName: d.storeName,
    primaryColor: d.primaryColor.toLowerCase(),
    heroTitle: d.heroTitle,
    heroSubtitle: d.heroSubtitle,
    heroCtaLabel: d.heroCtaLabel,
    aboutText: d.aboutText,
    address: d.address,
    openingHours: d.openingHours,
    phone: phone?.ok ? phone.value : null,
    email: d.email || null,
    mapsEmbedUrl: maps?.ok ? maps.value : null,
    socialLinks,
    seoTitle: d.seoTitle,
    seoDescription: d.seoDescription,
    showFeatured: formData.get("showFeatured") === "on",
    showNewArrivals: formData.get("showNewArrivals") === "on",
    metaPixelId: pixel.ok ? pixel.value : null,
    metaPixelEnabled: pixelEnabled,
  });
  refresh();
  invalidateCatalogue();
  return { ok: true, message: "Paramètres enregistrés.", submissionId };
}
