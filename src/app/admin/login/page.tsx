import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

/**
 * Lit ?next= CÔTÉ SERVEUR puis rend le formulaire. Ainsi le formulaire est présent
 * dans le HTML envoyé par le serveur (affichage immédiat, fonctionne même sans JS).
 * (Avec useSearchParams() dans le composant client, Next.js ne le rendrait que
 * dans le navigateur en production.)
 */
async function LoginFormWithRedirect({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : ""} />;
}

// Note : cette page ne lit volontairement PAS la session (cookies()).
// Next.js 16.4.6 lève une InvariantError en développement si cookies() est lu
// pendant le réaffichage qui suit une action serveur (tentative de connexion échouée).
export default function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold">Espace administrateur</h1>
        <p className="mt-1 text-sm text-slate-500">Connectez-vous pour gérer le catalogue.</p>

        {/* searchParams = donnée de la requête → doit être dans une frontière Suspense. */}
        <Suspense fallback={<div className="mt-6 h-56" aria-hidden />}>
          <LoginFormWithRedirect searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
