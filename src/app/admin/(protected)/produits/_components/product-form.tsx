"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ArrowLeft, CircleAlert, Eye, Loader2, Star, Trash2, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { submitWithoutReset } from "@/lib/forms";
import { PRODUCT_STATUSES, STATUS_INFO, type ProductStatusValue } from "@/lib/product-status";
import { slugify } from "@/lib/slug";
import { removeProduct, saveProduct, type ProductFormState, type ProductFormValues } from "@/server/products/actions";
import { PHOTO_REQUIRED_TO_PUBLISH } from "@/lib/product-visibility";
import { changeProductStatus } from "@/server/products/actions";
import { uploadProductImage } from "@/server/products/image-actions";
import { attachProductDraftAction } from "@/server/ai/actions";
import { defaultDraftChoice, DraftPhotos, type DraftChoice } from "./draft-photos";
import { NewProductAi, type ProductDraft } from "./new-product-ai";
import { PendingImages, type PendingImage } from "./pending-images";
import { ProductImages, type ProductImage } from "./product-images";

export type EditableProduct = ProductFormValues & { id: string; imageCount: number; images: ProductImage[] };
type CategoryOption = { id: string; name: string; isActive: boolean };

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="flex items-start gap-1.5 text-sm text-destructive">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {message}
    </p>
  );
}

export function ProductForm({
  product,
  categories,
  aiEnabled = false,
  aiConfigured = false,
}: {
  product: EditableProduct | null;
  categories: CategoryOption[];
  /** IA activée (AI_ENABLED) : affiche « Générer avec l'IA » sur la page Nouveau produit. */
  aiEnabled?: boolean;
  aiConfigured?: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ProductFormState, FormData>(saveProduct, undefined);
  const initial: ProductFormValues = product ? {
    name: product.name, slug: product.slug, description: product.description, reference: product.reference,
    brand: product.brand, categoryId: product.categoryId, status: product.status, isFeatured: product.isFeatured,
  } : {
    name: "",
    slug: "",
    description: "",
    reference: "",
    brand: "",
    categoryId: "",
    status: "PUBLISHED", // publié par défaut (réellement publié une fois la photo principale en place)
    isFeatured: false,
  };
  const [values, setValues] = useState<ProductFormValues>(initial);
  // Création : photos choisies avant l'enregistrement, envoyées juste après la création du produit.
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  // Création avec l'IA : proposition générée (photos + texte) et choix de l'admin.
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [draftChoice, setDraftChoice] = useState<DraftChoice>({ main: "original", keep: [] });
  const [generating, setGenerating] = useState(false);
  // Nouveau produit : photo principale obligatoire (message affiché si l'admin tente de créer sans photo).
  const [photoMissing, setPhotoMissing] = useState(false);
  const [slugEdited, setSlugEdited] = useState(Boolean(product));
  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  useEffect(() => {
    if (!state) return;
    if (!state.ok) {
      toast.error(state.message);
      return;
    }
    toast.success(state.message);
    if (!state.created) return;
    // Création réussie → envoi des photos choisies, puis page de modification du nouveau produit.
    const productId = state.id;
    const files = draft ? [] : pendingImages.map((i) => i.file);
    let cancelled = false;
    (async () => {
      if (draft) {
        // Photos générées : seules celles choisies par l'admin sont rattachées au produit.
        setUploadProgress("Ajout des photos choisies…");
        try {
          const result = await attachProductDraftAction(productId, draft.draftId, draftChoice);
          if (!result.ok) toast.error(result.message);
        } catch {
          toast.error("Photos non ajoutées. Vous pourrez les ajouter depuis la fiche.");
        }
      }
      for (const [index, file] of files.entries()) {
        if (cancelled) return;
        setUploadProgress(`Envoi des photos (${index + 1}/${files.length})…`);
        const data = new FormData();
        data.set("file", file);
        try {
          const result = await uploadProductImage(productId, data);
          if (!result.ok) toast.error(`Photo ${index + 1} : ${result.message}`);
        } catch {
          toast.error(`Photo ${index + 1} non envoyée. Vous pourrez l'ajouter depuis la fiche.`);
        }
      }
      // Publication demandée : faite maintenant que la photo est en place (refusée par le serveur sinon).
      if (state.pendingPublish && !cancelled) {
        try {
          const published = await changeProductStatus(productId, "PUBLISHED");
          if (published.ok) toast.success(published.message);
          else toast.warning(`Produit enregistré en brouillon. ${published.message}`);
        } catch {
          toast.warning("Produit enregistré en brouillon : publiez-le depuis sa fiche.");
        }
      }
      if (!cancelled) router.replace(`/admin/produits/${productId}`);
    })();
    return () => {
      cancelled = true;
    };
    // pendingImages / draft volontairement absents : seul un nouveau résultat d'enregistrement déclenche l'envoi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, router]);

  const failure = state && !state.ok ? state : null;
  const errorOf = (field: keyof ProductFormValues) =>
    failure?.fieldErrors[field as keyof typeof failure.fieldErrors] && failure.values[field] === values[field]
      ? failure.fieldErrors[field as keyof typeof failure.fieldErrors]
      : undefined;
  const generalError = failure && Object.keys(failure.fieldErrors).length === 0 ? failure.message : undefined;
  const inputProps = (field: "name" | "slug" | "description" | "reference" | "brand") => ({
    id: `p-${field}`,
    name: field,
    value: values[field],
    disabled: pending,
    "aria-invalid": errorOf(field) ? true : undefined,
    "aria-describedby": errorOf(field) ? `p-${field}-error` : undefined,
  });

  const category = categories.find((c) => c.id === values.categoryId);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  return (
    <form
      onSubmit={(event) => {
        // Nouveau produit : au moins une photo choisie (ou générée) avant la création.
        if (!product && !draft && pendingImages.length === 0) {
          event.preventDefault();
          setPhotoMissing(true);
          toast.error("Ajoutez la photo principale du produit avant de le créer.");
          document.getElementById("photos")?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        submitWithoutReset(formAction)(event);
      }}
      className="grid gap-6 pb-24"
      noValidate
    >
      <input type="hidden" name="id" value={product?.id ?? ""} />
      <input type="hidden" name="categoryId" value={values.categoryId} />
      <input type="hidden" name="isFeatured" value={values.isFeatured ? "on" : ""} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Colonne principale : contenu de la fiche */}
        <div className="grid content-start gap-6">
          {!product && aiEnabled && (
            <NewProductAi
              configured={aiConfigured}
              draft={draft}
              hints={{ name: values.name, categoryId: values.categoryId }}
              disabled={pending || uploadProgress !== null}
              onGenerating={setGenerating}
              onGenerated={(result) => {
                setDraft(result);
                setDraftChoice(defaultDraftChoice(result));
                if (result.text.ok) {
                  const { name, description } = result.text.value;
                  setValues((v) => ({ ...v, name, description, slug: slugEdited ? v.slug : slugify(name) }));
                }
              }}
              onReset={() => setDraft(null)}
            />
          )}
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="p-name">Nom du produit</Label>
                <Input
                  {...inputProps("name")}
                  onChange={(e) => {
                    set("name", e.target.value);
                    if (!slugEdited) set("slug", slugify(e.target.value));
                  }}
                  maxLength={120}
                  placeholder="Ex. Éponge grattoir double face x10"
                  autoFocus={!product}
                />
                <FieldError id="p-name-error" message={errorOf("name")} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="p-slug">Adresse de la page</Label>
                <div className="flex items-center rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                  <span className="select-none pl-2.5 text-sm text-muted-foreground">/produits/</span>
                  <input
                    {...inputProps("slug")}
                    onChange={(e) => {
                      setSlugEdited(true);
                      set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"));
                    }}
                    onBlur={() => set("slug", slugify(values.slug))}
                    maxLength={80}
                    spellCheck={false}
                    autoCapitalize="none"
                    className="h-8 min-w-0 flex-1 bg-transparent pr-2.5 text-sm outline-none disabled:opacity-50"
                  />
                </div>
                {errorOf("slug") ? (
                  <FieldError id="p-slug-error" message={errorOf("slug")} />
                ) : product && values.slug !== product.slug ? (
                  <p className="flex items-start gap-1.5 text-sm text-amber-700">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    Changer l&apos;adresse casse les liens déjà partagés vers ce produit.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Générée à partir du nom. Si elle existe déjà, un numéro est ajouté automatiquement.
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="p-description">Description</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">{values.description.length}/5000</span>
                </div>
                <Textarea
                  {...inputProps("description")}
                  onChange={(e) => set("description", e.target.value)}
                  maxLength={5000}
                  rows={6}
                  placeholder="Caractéristiques, usages, conditionnement…"
                />
                <FieldError id="p-description-error" message={errorOf("description")} />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="p-reference">Référence</Label>
                  <Input {...inputProps("reference")} onChange={(e) => set("reference", e.target.value)} maxLength={50} placeholder="Facultatif" spellCheck={false} />
                  <FieldError id="p-reference-error" message={errorOf("reference")} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="p-brand">Marque</Label>
                  <Input {...inputProps("brand")} onChange={(e) => set("brand", e.target.value)} maxLength={60} placeholder="Facultatif" />
                  <FieldError id="p-brand-error" message={errorOf("brand")} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="photos" className={photoMissing && !product && !draft && pendingImages.length === 0 ? "ring-2 ring-destructive/60" : undefined}>
            <CardHeader>
              <CardTitle>
                Photos
                {!product && <span className="ml-1.5 text-sm font-normal text-muted-foreground">(photo principale obligatoire)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {photoMissing && !product && !draft && pendingImages.length === 0 && (
                <p role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
                  <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Ajoutez au moins une photo : la première sera la photo principale.
                </p>
              )}
              {product ? (
                <ProductImages productId={product.id} productName={product.name} images={product.images} />
              ) : (
                draft ? (
                  <DraftPhotos draft={draft} choice={draftChoice} onChange={setDraftChoice} disabled={pending || uploadProgress !== null} />
                ) : (
                  <PendingImages images={pendingImages} onChange={setPendingImages} disabled={pending || uploadProgress !== null || generating} />
                )
              )}
            </CardContent>
          </Card>
        </div>

        {/* Colonne latérale : publication et organisation */}
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Publication</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <fieldset className="grid gap-2" disabled={pending}>
                <legend className="sr-only">Statut</legend>
                <input type="hidden" name="status" value={values.status} />
                {PRODUCT_STATUSES.map((s: ProductStatusValue) => (
                  <label
                    key={s}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${
                      values.status === s ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="status-choice"
                      value={s}
                      checked={values.status === s}
                      onChange={() => set("status", s)}
                      className="mt-1 accent-primary"
                    />
                    <span className="grid gap-0.5">
                      <span className="text-sm font-medium">{STATUS_INFO[s].label}</span>
                      <span className="text-xs text-muted-foreground">{STATUS_INFO[s].description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              {values.status === "PUBLISHED" && category && !category.isActive && (
                <p className="flex items-start gap-1.5 text-sm text-amber-700">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  La catégorie « {category.name} » est masquée : ce produit ne sera pas visible tant qu&apos;elle l&apos;est.
                </p>
              )}
              {values.status === "PUBLISHED" && product && product.imageCount === 0 && (
                product.status === "PUBLISHED" ? (
                  <p className="flex items-start gap-1.5 text-sm text-amber-700">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    Pas de photo : le site affiche une image par défaut (pictogramme de la catégorie). Ajoutez une photo dès que possible.
                  </p>
                ) : (
                  <p className="flex items-start gap-1.5 text-sm text-destructive">
                    <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    {PHOTO_REQUIRED_TO_PUBLISH}
                  </p>
                )
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organisation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="grid gap-2">
                <Label htmlFor="p-category">Catégorie</Label>
                <Select value={values.categoryId} onValueChange={(v) => set("categoryId", v)} disabled={pending}>
                  <SelectTrigger
                    id="p-category"
                    className="w-full"
                    aria-invalid={errorOf("categoryId") ? true : undefined}
                    aria-describedby={errorOf("categoryId") ? "p-categoryId-error" : undefined}
                  >
                    <SelectValue placeholder="Choisir une catégorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.isActive ? "" : " (masquée)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError id="p-categoryId-error" message={errorOf("categoryId")} />
                {categories.length === 0 && (
                  <p className="text-sm text-amber-700">
                    Aucune catégorie : <Link href="/admin/categories" className="underline">créez-en une d&apos;abord</Link>.
                  </p>
                )}
              </div>

              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div className="grid gap-1">
                  <Label htmlFor="p-featured" className="flex items-center gap-1.5">
                    <Star className="size-3.5 text-amber-500" aria-hidden />
                    Mis en avant
                  </Label>
                  <p className="text-xs text-muted-foreground">Affiché dans « Produits mis en avant » sur l&apos;accueil.</p>
                </div>
                <Switch id="p-featured" checked={values.isFeatured} onCheckedChange={(c) => set("isFeatured", c)} disabled={pending} />
              </div>
            </CardContent>
          </Card>

          {product && <DeleteProduct id={product.id} name={product.name} />}
        </div>
      </div>

      {generalError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {generalError}
        </p>
      )}

      {/* Barre d'enregistrement toujours visible */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <p className="w-full text-sm text-muted-foreground sm:mr-auto sm:w-auto" aria-live="polite">
            {uploadProgress ?? (pending ? "Enregistrement…" : dirty ? "Modifications non enregistrées" : product ? "Tout est enregistré" : "Nouveau produit")}
          </p>
          <Button variant="outline" asChild>
            <Link href="/admin/produits">
              <ArrowLeft className="size-4" aria-hidden />
              Liste
            </Link>
          </Button>
          {product &&
            (dirty ? (
              // L'aperçu montre la version enregistrée : on évite de perdre les modifications en cours.
              <Button type="button" variant="outline" disabled title="Enregistrez d'abord vos modifications">
                <Eye className="size-4" aria-hidden />
                Aperçu
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link href={`/admin/produits/${product.id}/apercu`}>
                  <Eye className="size-4" aria-hidden />
                  Aperçu
                </Link>
              </Button>
            ))}
          <Button type="submit" disabled={pending || uploadProgress !== null || generating}>
            {(pending || uploadProgress !== null) && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {product ? "Enregistrer" : "Créer le produit"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function DeleteProduct({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)} className="w-full">
        <Trash2 className="size-4" aria-hidden />
        Supprimer le produit
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !isPending && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le produit et ses photos seront supprimés définitivement. Pour le retirer du site sans le perdre,
              choisissez plutôt le statut « Masqué ».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const result = await removeProduct(id);
                  if (!result.ok) {
                    toast.error(result.message);
                    return;
                  }
                  toast.success(result.message);
                  router.push("/admin/produits");
                })
              }
            >
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Supprimer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
