"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Ellipsis, EyeOff, FilePen, ImageOff, Loader2, Pencil, Send, Star, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { changeProductStatus, removeProduct, toggleProductFeatured } from "@/server/products/actions";
import type { ProductListRow } from "@/server/products/service";
import { StatusBadge } from "./status-badge";

type ActionResult = { ok: boolean; message: string };
const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

export function ProductsTable({ rows }: { rows: ProductListRow[] }) {
  const [toDelete, setToDelete] = useState<ProductListRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(id: string, action: () => Promise<ActionResult>, after?: () => void) {
    setBusyId(id);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
        after?.();
      } catch {
        toast.error("Une erreur inattendue est survenue. Réessayez.");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-full text-sm" aria-label="Produits">
          <thead className="border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 md:w-[45%]">Produit</th>
              <th scope="col" className="hidden px-4 py-2.5 md:table-cell">Catégorie</th>
              <th scope="col" className="hidden px-4 py-2.5 sm:table-cell">Statut</th>
              <th scope="col" className="hidden px-4 py-2.5 lg:table-cell">Photos</th>
              <th scope="col" className="hidden px-4 py-2.5 lg:table-cell">Modifié le</th>
              <th scope="col" className="w-px px-2 py-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => {
              const busy = busyId === row.id && isPending;
              return (
                <tr key={row.id} className="align-top hover:bg-muted/30">
                  <td className="max-w-0 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => run(row.id, () => toggleProductFeatured(row.id, !row.isFeatured))}
                        disabled={busy}
                        aria-pressed={row.isFeatured}
                        aria-label={row.isFeatured ? `Retirer « ${row.name} » des produits mis en avant` : `Mettre « ${row.name} » en avant`}
                        title={row.isFeatured ? "Mis en avant (cliquer pour retirer)" : "Mettre en avant"}
                        className="mt-0.5 shrink-0 rounded text-muted-foreground transition-colors hover:text-amber-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      >
                        <Star className={`size-4 ${row.isFeatured ? "fill-amber-400 text-amber-500" : ""}`} aria-hidden />
                      </button>
                      <div className="min-w-0">
                        <Link href={`/admin/produits/${row.id}`} className="block truncate font-medium hover:underline">
                          {row.name}
                        </Link>
                        {(row.reference || row.brand) && (
                          <p className="truncate text-xs text-muted-foreground">
                            {[row.reference && `Réf. ${row.reference}`, row.brand].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {/* Sur petit écran : catégorie et statut sous le nom */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 md:hidden">
                          <span className="sm:hidden"><StatusBadge status={row.status} /></span>
                          <span className="text-xs text-muted-foreground">{row.category.name}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {row.category.name}
                    {!row.category.isActive && <span className="block text-xs text-amber-700">Catégorie masquée</span>}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell"><StatusBadge status={row.status} /></td>
                  <td className="hidden px-4 py-3 lg:table-cell">
                    {row.imageCount > 0 ? (
                      <span className="tabular-nums">{row.imageCount}/3</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <ImageOff className="size-3.5" aria-hidden />
                        Aucune
                      </span>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-muted-foreground lg:table-cell">
                    {dateFormat.format(new Date(row.updatedAt))}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="En cours…" />}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={busy} aria-label={`Actions pour ${row.name}`}>
                            <Ellipsis className="size-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/produits/${row.id}`}>
                              <Pencil aria-hidden />
                              Modifier
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {row.status !== "PUBLISHED" && (
                            <DropdownMenuItem onSelect={() => run(row.id, () => changeProductStatus(row.id, "PUBLISHED"))}>
                              <Send aria-hidden />
                              Publier
                            </DropdownMenuItem>
                          )}
                          {row.status !== "DRAFT" && (
                            <DropdownMenuItem onSelect={() => run(row.id, () => changeProductStatus(row.id, "DRAFT"))}>
                              <FilePen aria-hidden />
                              Repasser en brouillon
                            </DropdownMenuItem>
                          )}
                          {row.status !== "HIDDEN" && (
                            <DropdownMenuItem onSelect={() => run(row.id, () => changeProductStatus(row.id, "HIDDEN"))}>
                              <EyeOff aria-hidden />
                              Masquer du site
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(row)}>
                            <Trash2 aria-hidden />
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && !isPending && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {toDelete?.name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le produit et ses photos seront supprimés définitivement. Pour le retirer du site sans le perdre,
              utilisez plutôt « Masquer du site ».
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => toDelete && run(toDelete.id, () => removeProduct(toDelete.id), () => setToDelete(null))}
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
