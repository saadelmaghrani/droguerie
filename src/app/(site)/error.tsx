"use client";

// Erreur inattendue sur une page du site public (l'en-tête et le pied de page restent affichés).
import { ErrorState } from "@/components/error-state";

export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  return <ErrorState error={error} retry={retry} homeHref="/" homeLabel="Retour à l'accueil" />;
}
