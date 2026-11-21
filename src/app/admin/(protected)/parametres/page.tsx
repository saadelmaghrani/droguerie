import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/server/auth/dal";
import { getStoreSettings, toFormValues } from "@/server/settings/service";
import { PageHeader } from "../_components/page-header";
import { SettingsForm } from "./_components/settings-form";

export const metadata: Metadata = { title: "Paramètres" };

async function SettingsContent() {
  await requireAdmin(); // 1. vérification de la session, AVANT la lecture des données
  const settings = await getStoreSettings();
  return <SettingsForm initial={toFormValues(settings)} logoKey={settings.logoKey} heroImageKey={settings.heroImageKey} />;
}

function SettingsSkeleton() {
  return (
    <div className="grid gap-6" aria-hidden>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-64 rounded-xl" />
      ))}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Paramètres" description="Informations du magasin et apparence du site." />
      <Suspense fallback={<SettingsSkeleton />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}
