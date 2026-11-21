// « Introuvable » pour une adresse qui ne correspond à aucune page (hors mise en page du site).
import type { Metadata } from "next";
import { NotFoundContent } from "@/components/site/not-found-content";

export const metadata: Metadata = { title: "Page introuvable", robots: { index: false } };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 [--brand:#334155]">
      <NotFoundContent />
    </div>
  );
}
