"use client";
// Formulaires de la page « Mon compte ».
// Champs non contrôlés + submitWithoutReset : après une erreur, la saisie est conservée ;
// après un succès, la clé du formulaire change et les champs de mot de passe sont vidés.

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { CircleAlert, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitWithoutReset } from "@/lib/forms";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-rules";
import {
  changeEmailAction,
  changePasswordAction,
  updateNameAction,
  type EmailFormState,
  type NameFormState,
  type PasswordFormState,
} from "@/server/auth/account-actions";

type AnyState = NameFormState | PasswordFormState | EmailFormState;

/** Notification après chaque envoi ; renvoie un compteur de succès (sert de clé pour vider le formulaire). */
function useResultToast(state: AnyState): number {
  const [successes, setSuccesses] = useState(0);
  const [seen, setSeen] = useState<number | undefined>(undefined);
  if (state && state.submissionId !== seen) {
    setSeen(state.submissionId);
    if (state.ok) setSuccesses((n) => n + 1);
  }
  useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);
  return successes;
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm text-destructive">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function PasswordInput({
  id,
  name,
  autoComplete,
  error,
  disabled,
}: {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
  disabled: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        maxLength={256}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}

export function NameForm({ name }: { name: string }) {
  const [state, formAction, pending] = useActionState<NameFormState, FormData>(updateNameAction, undefined);
  useResultToast(state);
  const error = state && !state.ok ? state.fieldErrors.name : undefined;

  return (
    <Card>
      <form onSubmit={submitWithoutReset(formAction)} noValidate className="contents">
        <CardHeader>
          <CardTitle>Nom affiché</CardTitle>
          <CardDescription>Apparaît en bas du menu de l&apos;administration.</CardDescription>
        </CardHeader>
        <CardContent>
          <Field id="account-name" label="Nom" error={error}>
            <Input
              id="account-name"
              name="name"
              defaultValue={name}
              maxLength={60}
              autoComplete="name"
              disabled={pending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "account-name-error" : undefined}
            />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <SubmitButton pending={pending}>Enregistrer le nom</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState<PasswordFormState, FormData>(changePasswordAction, undefined);
  const successes = useResultToast(state);
  const errors = state && !state.ok ? state.fieldErrors : {};

  return (
    <Card>
      <form key={successes} onSubmit={submitWithoutReset(formAction)} noValidate className="contents">
        <CardHeader>
          <CardTitle>Mot de passe</CardTitle>
          <CardDescription>
            Après le changement, les autres appareils connectés sont déconnectés ; celui-ci reste connecté.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Field id="pw-current" label="Mot de passe actuel" error={errors.currentPassword}>
            <PasswordInput id="pw-current" name="currentPassword" autoComplete="current-password" error={errors.currentPassword} disabled={pending} />
          </Field>
          <Field
            id="pw-new"
            label="Nouveau mot de passe"
            hint={`Au moins ${PASSWORD_MIN_LENGTH} caractères. Une phrase facile à retenir convient très bien.`}
            error={errors.newPassword}
          >
            <PasswordInput id="pw-new" name="newPassword" autoComplete="new-password" error={errors.newPassword} disabled={pending} />
          </Field>
          <Field id="pw-confirm" label="Confirmer le nouveau mot de passe" error={errors.confirmPassword}>
            <PasswordInput id="pw-confirm" name="confirmPassword" autoComplete="new-password" error={errors.confirmPassword} disabled={pending} />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <SubmitButton pending={pending}>Changer le mot de passe</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<EmailFormState, FormData>(changeEmailAction, undefined);
  const successes = useResultToast(state);
  const errors = state && !state.ok ? state.fieldErrors : {};

  return (
    <Card>
      <form key={successes} onSubmit={submitWithoutReset(formAction)} noValidate className="contents">
        <CardHeader>
          <CardTitle>Email de connexion</CardTitle>
          <CardDescription>
            Email actuel : <span className="font-medium text-foreground">{email}</span>. Vérifiez bien la nouvelle
            adresse : c&apos;est elle qu&apos;il faudra saisir pour vous connecter.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <Field id="email-new" label="Nouvel email" error={errors.newEmail}>
            <Input
              id="email-new"
              name="newEmail"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={254}
              disabled={pending}
              aria-invalid={errors.newEmail ? true : undefined}
              aria-describedby={errors.newEmail ? "email-new-error" : undefined}
            />
          </Field>
          <Field id="email-password" label="Mot de passe actuel" hint="Demandé pour confirmer que c'est bien vous." error={errors.currentPassword}>
            <PasswordInput id="email-password" name="currentPassword" autoComplete="current-password" error={errors.currentPassword} disabled={pending} />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <SubmitButton pending={pending}>Changer l&apos;email</SubmitButton>
        </CardFooter>
      </form>
    </Card>
  );
}
