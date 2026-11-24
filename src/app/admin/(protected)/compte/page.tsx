import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/server/auth/dal";
import { PageHeader } from "../_components/page-header";
import { EmailForm, NameForm, PasswordForm } from "./_components/account-forms";

export const metadata: Metadata = { title: "Mon compte" };

async function AccountContent() {
  const admin = await requireAdmin(); // vérification de la session AVANT toute lecture
  return (
    <div className="grid max-w-2xl gap-6">
      <NameForm name={admin.name} />
      <PasswordForm />
      <EmailForm email={admin.email} />
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div className="grid max-w-2xl gap-6" aria-hidden>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-56 rounded-xl" />
      ))}
    </div>
  );
}

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Mon compte" description="Nom affiché, mot de passe et email de connexion." />
      <Suspense fallback={<AccountSkeleton />}>
        <AccountContent />
      </Suspense>
    </>
  );
}
