"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { CircleAlert, CircleCheck, Loader2, MapPin, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { isHexColor, readableTextColor } from "@/lib/color";
import { parseMapsEmbed } from "@/lib/external-links";
import { submitWithoutReset } from "@/lib/forms";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { saveStoreSettings, type SettingsFormState } from "@/server/settings/actions";
import type { StoreSettingsFormValues } from "@/server/settings/service";
import { StoreImageField } from "./store-image-field";

type Values = StoreSettingsFormValues;
type TextField = Exclude<keyof Values, "showFeatured" | "showNewArrivals">;

const PLACEHOLDER_MARK = "[À REMPLACER]";
const FIELD_LABELS: Partial<Record<TextField, string>> = {
  storeName: "Nom du magasin",
  heroTitle: "Titre de la bannière",
  heroSubtitle: "Sous-titre de la bannière",
  aboutText: "Présentation",
  address: "Adresse",
  openingHours: "Horaires",
  seoTitle: "Titre Google",
  seoDescription: "Description Google",
};

function Field({
  id,
  label,
  hint,
  error,
  count,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  count?: { value: number; max: number };
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {count && (
          <span className={`text-xs tabular-nums ${count.value > count.max ? "text-destructive" : "text-muted-foreground"}`}>
            {count.value}/{count.max}
          </span>
        )}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <div className="text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">{children}</CardContent>
    </Card>
  );
}

export function SettingsForm({
  initial,
  logoKey,
  heroImageKey,
}: {
  initial: Values;
  logoKey: string | null;
  heroImageKey: string | null;
}) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(saveStoreSettings, undefined);
  const [values, setValues] = useState(initial);

  // Après enregistrement, le serveur renvoie les valeurs normalisées (téléphone formaté, lien de
  // carte extrait…) : on resynchronise le formulaire (ajustement pendant le rendu, sans effet).
  const initialKey = JSON.stringify(initial);
  const [syncedKey, setSyncedKey] = useState(initialKey);
  if (initialKey !== syncedKey) {
    setSyncedKey(initialKey);
    setValues(initial);
  }

  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));
  const dirty = JSON.stringify(values) !== initialKey;
  const failure = state && !state.ok ? state : null;
  const errorOf = (field: keyof Values) => failure?.fieldErrors[field];
  const inputProps = (field: TextField) => ({
    id: `s-${field}`,
    name: field,
    value: values[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(field, e.target.value),
    disabled: pending,
    "aria-invalid": errorOf(field) ? true : undefined,
    "aria-describedby": errorOf(field) ? `s-${field}-error` : undefined,
  });

  const placeholders = (Object.keys(FIELD_LABELS) as TextField[]).filter((f) => values[f].includes(PLACEHOLDER_MARK));
  const colorOk = isHexColor(values.primaryColor);
  const phonePreview = values.phone.trim() ? normalizePhone(values.phone) : null;
  const mapsPreview = values.mapsEmbedUrl.trim() ? parseMapsEmbed(values.mapsEmbedUrl) : null;

  return (
    // onSubmit (et non action) : évite la réinitialisation automatique qui remettait les
    // interrupteurs à leur valeur de départ après l'enregistrement (voir src/lib/forms.ts).
    <form onSubmit={submitWithoutReset(formAction)} className="grid gap-6 pb-24" noValidate>
      <input type="hidden" name="showFeatured" value={values.showFeatured ? "on" : ""} />
      <input type="hidden" name="showNewArrivals" value={values.showNewArrivals ? "on" : ""} />

      {placeholders.length > 0 && (
        <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Textes de démonstration à remplacer avant la mise en ligne :</p>
            <p className="mt-1">{placeholders.map((f) => FIELD_LABELS[f]).join(" · ")}</p>
          </div>
        </div>
      )}

      <Section title="Identité" description="Nom affiché sur le site et couleur principale des boutons et liens.">
        <Field id="s-storeName" label="Nom du magasin" error={errorOf("storeName")}>
          <Input {...inputProps("storeName")} maxLength={60} />
        </Field>
        <Field
          id="s-primaryColor"
          label="Couleur principale"
          error={errorOf("primaryColor")}
          hint="Le texte des boutons passe automatiquement en blanc ou en foncé pour rester lisible."
        >
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="color"
              aria-label="Choisir la couleur"
              value={colorOk ? values.primaryColor : "#000000"}
              onChange={(e) => set("primaryColor", e.target.value)}
              disabled={pending}
              className="h-9 w-12 cursor-pointer rounded-md border bg-background p-1"
            />
            <Input {...inputProps("primaryColor")} className="w-32 font-mono" maxLength={7} spellCheck={false} />
            {colorOk && (
              <span
                className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium"
                style={{ backgroundColor: values.primaryColor, color: readableTextColor(values.primaryColor) }}
                aria-label="Aperçu d'un bouton du site"
              >
                Aperçu bouton
              </span>
            )}
          </div>
        </Field>
        <StoreImageField kind="logo" label="Logo" imageKey={logoKey} hint="PNG à fond transparent conseillé. Enregistré immédiatement." />
      </Section>

      <Section title="Bannière d'accueil" description="Le grand bloc en haut de la page d'accueil.">
        <Field id="s-heroTitle" label="Titre" error={errorOf("heroTitle")} count={{ value: values.heroTitle.length, max: 80 }}>
          <Input {...inputProps("heroTitle")} maxLength={80} />
        </Field>
        <Field id="s-heroSubtitle" label="Sous-titre" error={errorOf("heroSubtitle")} count={{ value: values.heroSubtitle.length, max: 200 }}>
          <Textarea {...inputProps("heroSubtitle")} maxLength={200} rows={2} />
        </Field>
        <Field id="s-heroCtaLabel" label="Texte du bouton" error={errorOf("heroCtaLabel")} hint="Le bouton mène au catalogue. Laissez vide pour le masquer.">
          <Input {...inputProps("heroCtaLabel")} maxLength={30} placeholder="Voir le catalogue" />
        </Field>
        <StoreImageField kind="hero" label="Image de la bannière" imageKey={heroImageKey} hint="Format paysage conseillé (au moins 1600 px de large). Enregistrée immédiatement." />
      </Section>

      <Section title="Présentation et informations pratiques" description="Chaque bloc laissé vide est automatiquement masqué sur le site.">
        <Field id="s-aboutText" label="Présentation du magasin" error={errorOf("aboutText")} count={{ value: values.aboutText.length, max: 2000 }}>
          <Textarea {...inputProps("aboutText")} maxLength={2000} rows={5} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="s-address" label="Adresse" error={errorOf("address")}>
            <Textarea {...inputProps("address")} maxLength={200} rows={3} />
          </Field>
          <Field id="s-openingHours" label="Horaires" error={errorOf("openingHours")} hint="Une ligne par période, ex. « Lundi – Samedi : 9h – 19h ».">
            <Textarea {...inputProps("openingHours")} maxLength={300} rows={3} />
          </Field>
          <Field
            id="s-phone"
            label="Téléphone"
            error={errorOf("phone")}
            hint={
              phonePreview?.ok ? (
                <span className="inline-flex items-center gap-1.5">
                  <CircleCheck className="size-3.5 text-emerald-600" aria-hidden />
                  Sera affiché : {formatPhone(phonePreview.value)}
                </span>
              ) : phonePreview ? (
                <span className="text-destructive">{phonePreview.error}</span>
              ) : (
                "Numéro du magasin (appel). Facultatif."
              )
            }
          >
            <Input {...inputProps("phone")} type="tel" inputMode="tel" placeholder="05 22 12 34 56" />
          </Field>
          <Field id="s-email" label="Email" error={errorOf("email")} hint="Facultatif.">
            <Input {...inputProps("email")} type="email" inputMode="email" autoCapitalize="none" placeholder="contact@exemple.ma" />
          </Field>
        </div>
        <Field
          id="s-mapsEmbedUrl"
          label="Carte Google Maps"
          error={errorOf("mapsEmbedUrl")}
          hint={
            mapsPreview && !mapsPreview.ok ? (
              <span className="text-destructive">{mapsPreview.error}</span>
            ) : (
              <>Dans Google Maps : <strong>Partager → Intégrer une carte → Copier le code</strong>, puis collez-le ici.</>
            )
          }
        >
          <Textarea {...inputProps("mapsEmbedUrl")} rows={2} spellCheck={false} className="font-mono text-xs" placeholder='<iframe src="https://www.google.com/maps/embed?pb=…"></iframe>' />
        </Field>
        {mapsPreview?.ok && (
          <div className="overflow-hidden rounded-lg border">
            <p className="flex items-center gap-1.5 border-b bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              Aperçu de la carte
            </p>
            <iframe
              src={mapsPreview.value}
              title="Aperçu de la carte Google Maps"
              className="h-56 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
      </Section>

      <Section title="Réseaux sociaux" description="Facultatif : des icônes apparaîtront dans le pied de page du site.">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="s-facebook" label="Facebook" error={errorOf("facebook")}>
            <Input {...inputProps("facebook")} placeholder="facebook.com/votre-page" autoCapitalize="none" spellCheck={false} />
          </Field>
          <Field id="s-instagram" label="Instagram" error={errorOf("instagram")}>
            <Input {...inputProps("instagram")} placeholder="instagram.com/votre-compte" autoCapitalize="none" spellCheck={false} />
          </Field>
          <Field id="s-tiktok" label="TikTok" error={errorOf("tiktok")}>
            <Input {...inputProps("tiktok")} placeholder="tiktok.com/@votre-compte" autoCapitalize="none" spellCheck={false} />
          </Field>
        </div>
      </Section>

      <Section title="Référencement Google" description="Titre et description affichés dans les résultats de recherche Google.">
        <Field id="s-seoTitle" label="Titre" error={errorOf("seoTitle")} count={{ value: values.seoTitle.length, max: 70 }}>
          <Input {...inputProps("seoTitle")} maxLength={70} />
        </Field>
        <Field id="s-seoDescription" label="Description" error={errorOf("seoDescription")} count={{ value: values.seoDescription.length, max: 160 }}>
          <Textarea {...inputProps("seoDescription")} maxLength={160} rows={2} />
        </Field>
        <div className="rounded-lg border bg-background p-4" aria-label="Aperçu dans Google">
          <p className="mb-2 text-xs text-muted-foreground">Aperçu dans Google</p>
          <p className="truncate text-lg text-[#1a0dab]">{values.seoTitle || values.storeName || "Titre de la page"}</p>
          <p className="text-xs text-[#006621]">https://votre-domaine.ma</p>
          <p className="mt-1 line-clamp-2 text-sm text-[#4d5156]">
            {values.seoDescription || "Ajoutez une description pour donner envie de cliquer."}
          </p>
        </div>
      </Section>

      <Section title="Page d'accueil" description="Sections affichées sous la bannière.">
        {(
          [
            ["showFeatured", "Produits mis en avant", "Les produits cochés « mis en avant » dans leur fiche."],
            ["showNewArrivals", "Nouveautés", "Les 8 derniers produits publiés, automatiquement."],
          ] as const
        ).map(([key, label, hint]) => (
          <div key={key} className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="grid gap-1">
              <Label htmlFor={`s-${key}`}>{label}</Label>
              <p className="text-xs text-muted-foreground">{hint} Masquée automatiquement si vide.</p>
            </div>
            <Switch id={`s-${key}`} checked={values[key]} onCheckedChange={(c) => set(key, c)} disabled={pending} />
          </div>
        ))}
      </Section>

      {/* Barre d'enregistrement toujours visible en bas de l'écran */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        {/* Mobile : statut sur sa propre ligne, boutons dessous ; ordinateur : tout sur une ligne. */}
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <p className="w-full text-sm text-muted-foreground sm:mr-auto sm:w-auto" aria-live="polite">
            {pending ? "Enregistrement…" : dirty ? "Modifications non enregistrées" : "Tout est enregistré"}
          </p>
          <Button type="button" variant="outline" disabled={!dirty || pending} onClick={() => setValues(initial)}>
            <span className="sm:hidden">Annuler</span>
            <span className="hidden sm:inline">Annuler les modifications</span>
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Enregistrer
          </Button>
        </div>
      </div>
    </form>
  );
}
