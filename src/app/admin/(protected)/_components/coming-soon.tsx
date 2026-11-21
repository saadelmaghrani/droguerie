// Contenu provisoire des sections pas encore développées.
// Vérifie la session comme une vraie page (requireAdmin) : aucune exception à la règle.
import { Construction } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/server/auth/dal";

export async function ComingSoon({ planned, features }: { planned: string; features: string[] }) {
  await requireAdmin();

  return (
    <Card>
      <CardContent className="flex flex-col items-center px-6 py-12 text-center">
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Construction className="size-6" aria-hidden />
        </span>
        <h2 className="text-base font-semibold">Section en cours de développement</h2>
        <p className="mt-1 text-sm text-muted-foreground">Prévue : {planned}</p>
        <ul className="mt-6 grid w-full max-w-md gap-2 text-left text-sm">
          {features.map((feature) => (
            <li key={feature} className="flex gap-2 rounded-lg border bg-background px-3 py-2">
              <span className="text-muted-foreground" aria-hidden>
                •
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ComingSoonSkeleton() {
  return <div className="h-80 animate-pulse rounded-xl bg-muted" aria-hidden />;
}
