"use client";

import { useActionState, useEffect, useState } from "react";
import { CircleAlert, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_ICON_KEYS, CATEGORY_ICONS, CategoryIcon, suggestCategoryIcon, type CategoryIconKey } from "@/lib/category-icons";
import { submitWithoutReset } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { formatPhone } from "@/lib/phone";
import { isValidSlug, slugify } from "@/lib/slug";
import { saveCategory, type CategoryFormState } from "@/server/categories/actions";
import type { CategoryRow, WhatsappOption } from "@/server/categories/service";

const DEFAULT_WHATSAPP = "default";
const DESCRIPTION_MAX = 500;

export function CategoryFormDialog({
  open,
  category,
  whatsappOptions,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  category: CategoryRow | null;
  whatsappOptions: WhatsappOption[];
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{category ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
          <DialogDescription>Les catégories organisent le catalogue sur le site.</DialogDescription>
        </DialogHeader>
        {open && (
          <CategoryForm
            key={category?.id ?? "new"}
            category={category}
            whatsappOptions={whatsappOptions}
            onSaved={onSaved}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

function CategoryForm({
  category,
  whatsappOptions,
  onSaved,
  onCancel,
}: {
  category: CategoryRow | null;
  whatsappOptions: WhatsappOption[];
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState<CategoryFormState, FormData>(saveCategory, undefined);
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  // Création : l'adresse suit le nom tant que l'admin ne l'a pas modifiée lui-même.
  const [slugEdited, setSlugEdited] = useState(Boolean(category));
  const [description, setDescription] = useState(category?.description ?? "");
  const [whatsappId, setWhatsappId] = useState(category?.whatsappNumberId ?? DEFAULT_WHATSAPP);
  const [isActive, setIsActive] = useState(category?.isActive ?? true);
  // "" = pictogramme suggéré automatiquement d'après le nom.
  const [icon, setIcon] = useState<string>(category?.icon ?? "");

  const successId = state?.ok ? state.submissionId : null;
  useEffect(() => {
    if (successId !== null && state?.ok) onSaved(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uniquement à chaque nouveau succès
  }, [successId]);

  const failure = state && !state.ok ? state : null;
  // Une erreur serveur disparaît dès que l'admin modifie le champ concerné.
  const errorFor = (field: "name" | "slug" | "description" | "whatsappNumberId", current: string) =>
    failure?.fieldErrors[field] && failure.values[field] === current ? failure.fieldErrors[field] : undefined;
  const nameError = errorFor("name", name);
  const slugError = errorFor("slug", slug) ?? (slug && !isValidSlug(slug) ? "Minuscules, chiffres et tirets uniquement." : undefined);
  const descriptionError = errorFor("description", description);
  const whatsappError = errorFor("whatsappNumberId", whatsappId);
  const generalError = failure && Object.keys(failure.fieldErrors).length === 0 ? failure.message : undefined;

  const defaultNumber = whatsappOptions.find((o) => o.isDefault);
  const selected = whatsappOptions.find((o) => o.id === whatsappId);
  const slugChangedOnExisting = category && slug !== category.slug;
  const hidesProducts = category && !isActive && category.isActive && category.productCount > 0;

  return (
    // onSubmit (et non action) : évite la réinitialisation automatique qui annulait
    // l'interrupteur « Visible » et la liste WhatsApp après une erreur (voir src/lib/forms.ts).
    <form onSubmit={submitWithoutReset(formAction)} className="grid gap-5" noValidate>
      <input type="hidden" name="id" value={category?.id ?? ""} />
      <input type="hidden" name="whatsappNumberId" value={whatsappId} />
      <input type="hidden" name="isActive" value={isActive ? "on" : ""} />
      <input type="hidden" name="icon" value={icon} />

      <div className="grid gap-2">
        <Label htmlFor="cat-name">Nom</Label>
        <Input
          id="cat-name"
          name="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
          placeholder="Ex. Produits d'entretien"
          maxLength={60}
          autoFocus
          disabled={pending}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "cat-name-error" : undefined}
        />
        <FieldError id="cat-name-error" message={nameError} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="cat-slug">Adresse de la page</Label>
        <div className="flex items-center rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive">
          <span className="select-none pl-2.5 text-sm text-muted-foreground">/categories/</span>
          <input
            id="cat-slug"
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
            }}
            onBlur={() => setSlug((s) => slugify(s))}
            maxLength={80}
            spellCheck={false}
            autoCapitalize="none"
            disabled={pending}
            aria-invalid={slugError ? true : undefined}
            aria-describedby="cat-slug-hint"
            className="h-8 min-w-0 flex-1 bg-transparent pr-2.5 text-sm outline-none disabled:opacity-50"
          />
        </div>
        <div id="cat-slug-hint">
          {slugError ? (
            <FieldError id="cat-slug-error" message={slugError} />
          ) : slugChangedOnExisting ? (
            <p className="flex items-start gap-1.5 text-sm text-amber-700">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Changer l&apos;adresse casse les liens déjà partagés et le référencement de l&apos;ancienne page.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Générée à partir du nom. Modifiable si besoin.</p>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="cat-description">Description</Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {description.length}/{DESCRIPTION_MAX}
          </span>
        </div>
        <Textarea
          id="cat-description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={DESCRIPTION_MAX}
          rows={3}
          placeholder="Facultatif — affichée sur la page de la catégorie."
          disabled={pending}
          aria-invalid={descriptionError ? true : undefined}
        />
        <FieldError id="cat-description-error" message={descriptionError} />
      </div>

      <IconPicker value={icon} onChange={setIcon} name={name} disabled={pending} />

      <div className="grid gap-2">
        <Label htmlFor="cat-whatsapp">Numéro WhatsApp</Label>
        <Select value={whatsappId} onValueChange={setWhatsappId} disabled={pending}>
          <SelectTrigger id="cat-whatsapp" className="w-full" aria-invalid={whatsappError ? true : undefined}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_WHATSAPP}>
              Numéro par défaut{defaultNumber ? ` (${defaultNumber.label})` : ""}
            </SelectItem>
            {whatsappOptions.length > 0 && <SelectSeparator />}
            {whatsappOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label} · {formatPhone(option.phone)}
                {!option.isActive && " (inactif)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {whatsappError ? (
          <FieldError id="cat-whatsapp-error" message={whatsappError} />
        ) : selected && !selected.isActive ? (
          <p className="flex items-start gap-1.5 text-sm text-amber-700">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Ce numéro est inactif : le numéro par défaut sera utilisé tant qu&apos;il n&apos;est pas réactivé.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Les boutons WhatsApp des produits de cette catégorie mèneront à ce numéro.
          </p>
        )}
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
        <div className="grid gap-1">
          <Label htmlFor="cat-active">Visible sur le site</Label>
          <p className="text-xs text-muted-foreground">
            Une catégorie masquée disparaît du site, ainsi que tous ses produits.
          </p>
          {hidesProducts && (
            <p className="flex items-start gap-1.5 text-sm text-amber-700">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Ses {category.productCount} produit{category.productCount > 1 ? "s" : ""} ne seront plus visibles.
            </p>
          )}
        </div>
        <Switch id="cat-active" checked={isActive} onCheckedChange={setIsActive} disabled={pending} />
      </div>

      {generalError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {generalError}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {category ? "Enregistrer" : "Créer la catégorie"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Choix du pictogramme : « Automatique » (suggéré d'après le nom) ou une icône précise. */
function IconPicker({ value, onChange, name, disabled }: { value: string; onChange: (icon: string) => void; name: string; disabled: boolean }) {
  const suggested = suggestCategoryIcon(name);
  const option = (key: string, label: string, icon: CategoryIconKey) => (
    <label
      key={key || "auto"}
      title={label}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-1 rounded-lg border p-2 text-center text-[11px] leading-tight transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        value === key ? "border-primary bg-primary/5 text-foreground" : "text-muted-foreground hover:bg-muted/50",
      )}
    >
      <input type="radio" name="cat-icon" value={key} checked={value === key} onChange={() => onChange(key)} disabled={disabled} className="sr-only" />
      <CategoryIcon icon={icon} className="size-6 text-foreground" />
      <span className="line-clamp-2">{label}</span>
    </label>
  );
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">Pictogramme</legend>
      <div className="grid max-h-56 grid-cols-4 gap-1.5 overflow-y-auto rounded-lg border p-1.5 sm:grid-cols-6">
        {option("", "Automatique", suggested)}
        {CATEGORY_ICON_KEYS.map((key) => option(key, CATEGORY_ICONS[key].label, key))}
      </div>
      <p className="text-xs text-muted-foreground">
        Affiché dans le menu du site. « Automatique » choisit d&apos;après le nom (ici : {CATEGORY_ICONS[suggested].label.toLowerCase()}).
      </p>
    </fieldset>
  );
}
