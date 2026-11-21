"use client";

// Bandeau de l'aperçu : ce qui empêche (ou gêne) l'affichage du produit, et publication directe.
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { CircleCheck, CircleX, Loader2, Pencil, Send, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProductStatusValue } from "@/lib/product-status";
import type { VisibilityIssue } from "@/lib/product-visibility";
import { changeProductStatus } from "@/server/products/actions";

export function PreviewToolbar({
  productId,
  status,
  issues,
}: {
  productId: string;
  status: ProductStatusValue;
  issues: VisibilityIssue[];
}) {
  const [isPending, startTransition] = useTransition();
  const visible = !issues.some((i) => i.level === "blocking");

  function publish() {
    startTransition(async () => {
      try {
        const result = await changeProductStatus(productId, "PUBLISHED");
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
      } catch {
        toast.error("Publication impossible. Vérifiez la connexion et réessayez.");
      }
    });
  }

  return (
    <div className="grid gap-4 rounded-xl border bg-background p-4 sm:flex sm:items-start sm:justify-between">
      <div className="grid gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          {visible ? (
            <>
              <CircleCheck className="size-4 text-emerald-600" aria-hidden />
              Visible sur le site
            </>
          ) : (
            <>
              <CircleX className="size-4 text-muted-foreground" aria-hidden />
              Pas encore visible sur le site
            </>
          )}
        </p>
        {issues.length > 0 && (
          <ul className="grid gap-1 text-sm">
            {issues.map((issue) => (
              <li
                key={issue.message}
                className={`flex items-start gap-1.5 ${issue.level === "blocking" ? "text-muted-foreground" : "text-amber-700"}`}
              >
                {issue.level === "blocking" ? (
                  <CircleX className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                ) : (
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                )}
                {issue.message}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
        <Button variant="outline" asChild>
          <Link href={`/admin/produits/${productId}`}>
            <Pencil className="size-4" aria-hidden />
            Modifier
          </Link>
        </Button>
        {status !== "PUBLISHED" && (
          <Button onClick={publish} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
            Publier
          </Button>
        )}
      </div>
    </div>
  );
}
