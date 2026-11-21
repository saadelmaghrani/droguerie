"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Ellipsis,
  ExternalLink,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Star,
  Trash2,
} from "lucide-react";
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
import { formatPhone, whatsappUrl } from "@/lib/phone";
import {
  makeDefaultWhatsappNumber,
  removeWhatsappNumber,
  toggleWhatsappNumber,
} from "@/server/whatsapp/actions";
import type { WhatsappNumberRow } from "@/server/whatsapp/service";
import { WhatsappFormDialog, type EditableNumber } from "./whatsapp-form-dialog";

type ActionResult = { ok: boolean; message: string };

export function WhatsappManager({ numbers }: { numbers: WhatsappNumberRow[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EditableNumber | null>(null);
  const [toDelete, setToDelete] = useState<WhatsappNumberRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(row: WhatsappNumberRow) {
    setEditing({ id: row.id, label: row.label, phone: row.phone });
    setFormOpen(true);
  }

  /** Lance une action serveur sur une ligne, puis affiche le résultat en notification. */
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
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 rounded-xl border bg-background p-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Chaque catégorie utilise <span className="font-medium text-foreground">son propre numéro</span> s&apos;il est
          actif, sinon le <span className="font-medium text-foreground">numéro par défaut</span>.
        </p>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="size-4" aria-hidden />
          Ajouter un numéro
        </Button>
      </div>

      {numbers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <MessageCircle className="size-6" aria-hidden />
            </span>
            <h2 className="font-semibold">Aucun numéro WhatsApp</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Ajoutez le numéro principal du magasin : il deviendra automatiquement le numéro par défaut.
            </p>
            <Button onClick={openCreate} className="mt-6">
              <Plus className="size-4" aria-hidden />
              Ajouter un numéro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3" aria-label="Numéros WhatsApp">
          {numbers.map((row) => {
            const busy = busyId === row.id && isPending;
            return (
              <li key={row.id}>
                <Card className={row.isActive ? undefined : "bg-muted/40"}>
                  <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                          row.isActive ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
                        }`}
                        aria-hidden
                      >
                        <MessageCircle className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-medium">{row.label}</h3>
                          {row.isDefault && (
                            <Badge>
                              <Star className="size-3" aria-hidden />
                              Par défaut
                            </Badge>
                          )}
                          {!row.isActive && <Badge variant="outline">Inactif</Badge>}
                        </div>
                        <p className="mt-0.5 text-sm tabular-nums text-muted-foreground">{formatPhone(row.phone)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.categories.length > 0
                            ? `Catégories : ${row.categories.join(", ")}`
                            : row.isDefault
                              ? "Utilisé par toutes les catégories sans numéro"
                              : "Aucune catégorie associée"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {busy && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="En cours…" />}
                      <Button variant="outline" size="sm" asChild>
                        <a href={whatsappUrl(row.phone)} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-3.5" aria-hidden />
                          Tester
                          <span className="sr-only"> le numéro {row.label} (nouvel onglet)</span>
                        </a>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={busy} aria-label={`Actions pour ${row.label}`}>
                            <Ellipsis className="size-4" aria-hidden />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onSelect={() => openEdit(row)}>
                            <Pencil aria-hidden />
                            Modifier
                          </DropdownMenuItem>
                          {!row.isDefault && (
                            <DropdownMenuItem onSelect={() => run(row.id, () => makeDefaultWhatsappNumber(row.id))}>
                              <Star aria-hidden />
                              Définir par défaut
                            </DropdownMenuItem>
                          )}
                          {row.isActive ? (
                            <DropdownMenuItem
                              disabled={row.isDefault}
                              onSelect={() => run(row.id, () => toggleWhatsappNumber(row.id, false))}
                            >
                              <PowerOff aria-hidden />
                              {row.isDefault ? "Désactiver (choisir un autre défaut)" : "Désactiver"}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onSelect={() => run(row.id, () => toggleWhatsappNumber(row.id, true))}>
                              <Power aria-hidden />
                              Activer
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={row.isDefault}
                            onSelect={() => setToDelete(row)}
                          >
                            <Trash2 aria-hidden />
                            {row.isDefault ? "Supprimer (choisir un autre défaut)" : "Supprimer"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <WhatsappFormDialog
        open={formOpen}
        number={editing}
        onOpenChange={setFormOpen}
        onSaved={(message) => {
          setFormOpen(false);
          toast.success(message);
        }}
      />

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && !isPending && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {toDelete?.label} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete && toDelete.categories.length > 0
                ? `Ce numéro est utilisé par ${toDelete.categories.length} catégorie${toDelete.categories.length > 1 ? "s" : ""} (${toDelete.categories.join(", ")}). Elle${toDelete.categories.length > 1 ? "s utiliseront" : " utilisera"} ensuite le numéro par défaut.`
                : "Ce numéro n'est utilisé par aucune catégorie."}{" "}
              Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => toDelete && run(toDelete.id, () => removeWhatsappNumber(toDelete.id), () => setToDelete(null))}
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
