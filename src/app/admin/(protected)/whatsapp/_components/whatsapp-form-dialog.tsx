"use client";

import { useActionState, useEffect, useState } from "react";
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react";
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
import { formatPhone, normalizePhone } from "@/lib/phone";
import { saveWhatsappNumber, type FormState } from "@/server/whatsapp/actions";

export type EditableNumber = { id: string; label: string; phone: string };

/** Fenêtre d'ajout (number = null) ou de modification d'un numéro. */
export function WhatsappFormDialog({
  open,
  number,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  number: EditableNumber | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (message: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{number ? "Modifier le numéro" : "Ajouter un numéro"}</DialogTitle>
          <DialogDescription>
            Les clients seront redirigés vers ce numéro depuis les produits des catégories qui l&apos;utilisent.
          </DialogDescription>
        </DialogHeader>
        {/* key : formulaire neuf à chaque ouverture (pas de reste de la saisie précédente). */}
        {open && <WhatsappForm key={number?.id ?? "new"} number={number} onSaved={onSaved} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function WhatsappForm({
  number,
  onSaved,
  onCancel,
}: {
  number: EditableNumber | null;
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveWhatsappNumber, undefined);
  const [label, setLabel] = useState(number?.label ?? "");
  const [phone, setPhone] = useState(number ? formatPhone(number.phone) : "");
  const [phoneTouched, setPhoneTouched] = useState(false);

  // Succès → fermer la fenêtre et afficher la notification.
  const successId = state?.ok ? state.submissionId : null;
  useEffect(() => {
    if (successId !== null && state?.ok) onSaved(state.message);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uniquement à chaque nouveau succès
  }, [successId]);

  const preview = phone.trim() ? normalizePhone(phone) : null;
  const failure = state && !state.ok ? state : null;
  const serverErrors = failure?.fieldErrors ?? {};
  // L'erreur serveur ne s'affiche que tant que l'utilisateur n'a pas modifié le champ.
  const labelError = serverErrors.label && label === failure?.values.label ? serverErrors.label : undefined;
  const phoneError = serverErrors.phone && phone === failure?.values.phone ? serverErrors.phone : undefined;
  const generalError = failure && !serverErrors.label && !serverErrors.phone ? failure.message : undefined;

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <input type="hidden" name="id" value={number?.id ?? ""} />

      <div className="grid gap-2">
        <Label htmlFor="wa-label">Libellé</Label>
        <Input
          id="wa-label"
          name="label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex. Service peinture"
          maxLength={60}
          required
          autoFocus
          disabled={pending}
          aria-invalid={labelError ? true : undefined}
          aria-describedby={labelError ? "wa-label-error" : "wa-label-hint"}
        />
        {labelError ? (
          <p id="wa-label-error" className="text-sm text-destructive">{labelError}</p>
        ) : (
          <p id="wa-label-hint" className="text-xs text-muted-foreground">Visible uniquement dans l&apos;administration.</p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="wa-phone">Numéro WhatsApp</Label>
        <Input
          id="wa-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={() => setPhoneTouched(true)}
          placeholder="06 12 34 56 78"
          required
          disabled={pending}
          aria-invalid={phoneError || (phoneTouched && preview && !preview.ok) ? true : undefined}
          aria-describedby="wa-phone-feedback"
        />
        <div id="wa-phone-feedback" aria-live="polite" className="min-h-5 text-sm">
          {phoneError ? (
            <p className="flex items-start gap-1.5 text-destructive">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {phoneError}
            </p>
          ) : preview?.ok ? (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <CircleCheck className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
              Sera enregistré : <span className="font-medium text-foreground tabular-nums">{formatPhone(preview.value)}</span>
            </p>
          ) : preview && phoneTouched ? (
            <p className="flex items-start gap-1.5 text-destructive">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {preview.error}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Format marocain (06…, 07…, 05…) ou international (+…).</p>
          )}
        </div>
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
          {number ? "Enregistrer" : "Ajouter"}
        </Button>
      </DialogFooter>
    </form>
  );
}
