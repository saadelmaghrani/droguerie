"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "@/server/auth/actions";

// Styles partagés des champs : bordure fine, focus visible, état invalide, état désactivé.
const inputClass =
  "block h-11 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-[15px] text-slate-900 " +
  "shadow-xs placeholder:text-slate-400 transition-[border-color,box-shadow] " +
  "hover:border-slate-400 " +
  "focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/15 " +
  "aria-invalid:border-red-400 aria-invalid:focus:border-red-500 aria-invalid:focus:ring-red-500/15 " +
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden
    >
      <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="m3 3 18 18" />}
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4 animate-spin" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity={0.25} strokeWidth={3} />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}

/** `next` : page admin à ouvrir après connexion (vérifiée côté serveur). */
export function LoginForm({ next }: { next: string }) {
  // state = résultat renvoyé par l'action (message d'erreur) ; pending = envoi en cours.
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, undefined);
  const [showPassword, setShowPassword] = useState(false);
  const hasError = Boolean(state?.error);

  return (
    // Sans JavaScript, le formulaire est envoyé normalement à l'action serveur.
    <form action={formAction} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="vous@exemple.com"
          defaultValue={state?.email}
          disabled={pending}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? "login-error" : undefined}
          className={inputClass}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Mot de passe
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={pending}
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? "login-error" : undefined}
            className={`${inputClass} pr-11`}
          />
          {/* type="button" : ce bouton ne soumet jamais le formulaire. */}
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            aria-pressed={showPassword}
            aria-controls="password"
            disabled={pending}
            className="absolute inset-y-0 right-0 my-1 mr-1 flex w-9 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40 disabled:pointer-events-none disabled:opacity-50"
          >
            <EyeIcon crossed={showPassword} />
          </button>
        </div>
      </div>

      {/* aria-live : le message est lu par les lecteurs d'écran dès qu'il apparaît. */}
      <div aria-live="polite">
        {hasError && (
          <p
            id="login-error"
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0" aria-hidden>
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                clipRule="evenodd"
              />
            </svg>
            <span>{state?.error}</span>
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/25 active:bg-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700"
      >
        {pending && <Spinner />}
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
