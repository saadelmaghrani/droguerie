import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Tableau de bord" };

async function DashboardContent() {
  const admin = await requireAdmin(); // vérification complète en base
  return (
    <p className="mt-2 text-slate-600">
      Bienvenue, {admin.name}. Les statistiques et la gestion du catalogue arriveront ici.
    </p>
  );
}

export default function DashboardPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Tableau de bord</h1>
      <Suspense fallback={<p className="mt-2 text-slate-400">Chargement…</p>}>
        <DashboardContent />
      </Suspense>
    </>
  );
}
