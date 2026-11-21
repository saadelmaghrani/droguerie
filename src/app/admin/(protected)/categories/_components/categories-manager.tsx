"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Ellipsis,
  Eye,
  EyeOff,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Tags,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { CategoryIcon, categoryIconKey } from "@/lib/category-icons";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPhone } from "@/lib/phone";
import {
  moveCategoryDown,
  moveCategoryUp,
  removeCategory,
  toggleCategory,
} from "@/server/categories/actions";
import type { CategoryRow, WhatsappOption } from "@/server/categories/service";
import { CategoryFormDialog } from "./category-form-dialog";

type ActionResult = { ok: boolean; message: string };

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

/** Texte « quel numéro WhatsApp est réellement utilisé » pour une catégorie. */
function WhatsappInfo({ row, defaultNumber }: { row: CategoryRow; defaultNumber?: WhatsappOption }) {
  if (row.whatsapp && row.whatsapp.isActive) {
    return (
      <span>
        {row.whatsapp.label} · <span className="tabular-nums">{formatPhone(row.whatsapp.phone)}</span>
      </span>
    );
  }
  const fallback = defaultNumber ? `numéro par défaut (${defaultNumber.label})` : "aucun numéro par défaut";
  if (row.whatsapp && !row.whatsapp.isActive) {
    return (
      <span className="inline-flex items-center gap-1 text-amber-700">
        <TriangleAlert className="size-3" aria-hidden />« {row.whatsapp.label} » inactif → {fallback}
      </span>
    );
  }
  return <span>{fallback.charAt(0).toUpperCase() + fallback.slice(1)}</span>;
}

export function CategoriesManager({
  categories,
  whatsappOptions,
}: {
  categories: CategoryRow[];
  whatsappOptions: WhatsappOption[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [toDelete, setToDelete] = useState<CategoryRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const defaultNumber = whatsappOptions.find((o) => o.isDefault);

  function openForm(row: CategoryRow | null) {
    setEditing(row);
    setFormOpen(true);
  }

  function run(id: string, action: () => Promise<ActionResult>, options?: { after?: () => void; silent?: boolean }) {
    setBusyId(id);
    startTransition(async () => {
      try {
        const result = await action();
        if (!result.ok) toast.error(result.message);
        else if (!options?.silent) toast.success(result.message);
        options?.after?.();
      } catch {
        toast.error("Une erreur inattendue est survenue. Réessayez.");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-background p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          L&apos;ordre ci-dessous est l&apos;ordre d&apos;affichage sur le site. Utilisez ↑ ↓ pour le modifier.
        </p>
        <Button onClick={() => openForm(null)} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          Nouvelle catégorie
        </Button>
      </div>

      {!defaultNumber && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Aucun numéro WhatsApp par défaut : les catégories sans numéro n&apos;auront pas de bouton WhatsApp
          fonctionnel. Ajoutez-en un dans la section WhatsApp.
        </p>
      )}

      {categories.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Tags className="size-6" aria-hidden />
            </span>
            <h2 className="font-semibold">Aucune catégorie</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Créez vos premières catégories (ex. Entretien, Peinture) avant d&apos;ajouter des produits.
            </p>
            <Button onClick={() => openForm(null)} className="mt-6">
              <Plus className="size-4" aria-hidden />
              Nouvelle catégorie
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ol className="grid gap-3" aria-label="Catégories">
          {categories.map((row, index) => {
            const busy = busyId === row.id && isPending;
            return (
              <li key={row.id}>
                <Card className={row.isActive ? undefined : "bg-muted/40"}>
                  <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      {/* Ordre d'affichage */}
                      <div className="flex shrink-0 flex-col items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          disabled={index === 0 || isPending}
                          aria-label={`Monter ${row.name}`}
                          onClick={() => run(row.id, () => moveCategoryUp(row.id), { silent: true })}
                        >
                          <ArrowUp aria-hidden />
                        </Button>
                        <span className="text-xs tabular-nums text-muted-foreground" aria-hidden>
                          {index + 1}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          disabled={index === categories.length - 1 || isPending}
                          aria-label={`Descendre ${row.name}`}
                          onClick={() => run(row.id, () => moveCategoryDown(row.id), { silent: true })}
                        >
                          <ArrowDown aria-hidden />
                        </Button>
                      </div>

                      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden>
                        <CategoryIcon icon={categoryIconKey(row.icon, row.name)} className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-medium">{row.name}</h3>
                          {!row.isActive && (
                            <Badge variant="outline">
                              <EyeOff className="size-3" aria-hidden />
                              Masquée
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">/categories/{row.slug}</p>
                        <p className="mt-1.5 text-sm text-muted-foreground">
                          {plural(row.productCount, "produit")}
                          {row.productCount > 0 && ` · ${plural(row.publishedCount, "publié")}`}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MessageCircle className="size-3 shrink-0" aria-hidden />
                          <WhatsappInfo row={row} defaultNumber={defaultNumber} />
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="En cours…" />}
                      <Button variant="outline" size="sm" onClick={() => openForm(row)} disabled={busy}>
                        <Pencil className="size-3.5" aria-hidden />
                        Modifier
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={busy} aria-label={`Actions pour ${row.name}`}>
                            <Ellipsis className="size-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-60">
                          {row.isActive ? (
                            <DropdownMenuItem onSelect={() => run(row.id, () => toggleCategory(row.id, false))}>
                              <EyeOff aria-hidden />
                              Masquer du site
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => run(row.id, () => toggleCategory(row.id, true))}>
                              <Eye aria-hidden />
                              Afficher sur le site
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={row.productCount > 0}
                            onSelect={() => setToDelete(row)}
                          >
                            <Trash2 aria-hidden />
                            {row.productCount > 0 ? `Supprimer (contient ${plural(row.productCount, "produit")})` : "Supprimer"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      <CategoryFormDialog
        open={formOpen}
        category={editing}
        whatsappOptions={whatsappOptions}
        onOpenChange={setFormOpen}
        onSaved={(message) => {
          setFormOpen(false);
          toast.success(message);
        }}
      />

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && !isPending && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {toDelete?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              La catégorie ne contient aucun produit. Son adresse (/categories/{toDelete?.slug}) ne fonctionnera
              plus. Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => toDelete && run(toDelete.id, () => removeCategory(toDelete.id), { after: () => setToDelete(null) })}
            >
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Supprimer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
