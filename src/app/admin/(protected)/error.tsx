"use client";

// Erreur inattendue dans une page d'administration (le menu reste affiché).
import { ErrorState } from "@/components/error-state";

export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState error={error} retry={retry} homeHref="/admin" homeLabel="Tableau de bord" />;
}
