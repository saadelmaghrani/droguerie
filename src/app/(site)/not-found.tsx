// « Introuvable » à l'intérieur du site public (avec en-tête et pied de page) : notFound() dans une page.
import type { Metadata } from "next";
import { NotFoundContent } from "@/components/site/not-found-content";

export const metadata: Metadata = { title: "Page introuvable", robots: { index: false } };

export default function SiteNotFound() {
  return <NotFoundContent />;
}
