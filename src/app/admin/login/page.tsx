import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

/**
 * Lit ?next= CÔTÉ SERVEUR puis rend le formulaire. Ainsi le formulaire est présent
 * dans le HTML envoyé par le serveur (affichage immédiat, fonctionne même sans JS).
 * (Avec useSearchParams() dans le composant client, Next.js ne le rendrait que
 * dans le navigateur en production.)
 */
async function LoginFormWithRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : ""} />;
}

/** Squelette affiché pendant le chargement : mêmes dimensions que le formulaire (pas de saut). */
function LoginFormSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-4 w-24 rounded bg-slate-100" />
          <div className="h-11 rounded-lg bg-slate-100" />
        </div>
      ))}
      <div className="h-11 rounded-lg bg-slate-200" />
    </div>
  );
}

// Note : cette page ne lit volontairement PAS la session (cookies()).
// Next.js 16.4.6 lève une InvariantError en développement si cookies() est lu
// pendant le réaffichage qui suit une action serveur (tentative de connexion échouée).
export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-12">
      {/* Fond discret : léger dégradé + grille fine */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgb(226_232_240)_0%,_transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgb(226_232_240)_1px,transparent_1px),linear-gradient(90deg,rgb(226_232_240)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]"
      />

      <div className="relative w-full max-w-[400px]">
        <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-8 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_8px_24px_-8px_rgb(15_23_42/0.12)] sm:px-8 sm:py-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-6"
                aria-hidden
              >
                <rect x="4" y="10" width="16" height="11" rx="2" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                <circle cx="12" cy="15.5" r="1.25" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              Espace administrateur
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Connectez-vous pour gérer les produits, WhatsApp et la boutique.
            </p>
          </div>

          {/* searchParams = donnée de la requête → doit être dans une frontière Suspense. */}
          <Suspense fallback={<LoginFormSkeleton />}>
            <LoginFormWithRedirect searchParams={searchParams} />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link
            href="/"
            className="rounded font-medium text-slate-600 underline-offset-4 transition-colors hover:text-slate-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            ← Retour au site
          </Link>
        </p>
      </div>
    </main>
  );
}
