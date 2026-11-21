// Indicateur : valeur, définition, variation par rapport à la période précédente (texte + flèche,
// jamais la couleur seule).
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function KpiTile({ label, value, hint, change, suffix = "" }: { label: string; value: string; hint: string; change?: number | null; suffix?: string }) {
  const Icon = change == null ? null : change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : ArrowRight;
  return (
    <Card className="gap-0 py-4">
      <CardContent className="grid gap-1 px-4">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tabular-nums tracking-tight">
          {value}
          {suffix}
        </span>
        <span className="text-xs text-muted-foreground">{hint}</span>
        {change !== undefined && (
          <span className="mt-1 flex items-center gap-1 text-xs text-foreground/80">
            {Icon && <Icon className="size-3.5" aria-hidden />}
            {change == null ? "Pas de comparaison possible" : `${change > 0 ? "+" : ""}${change} % vs période précédente`}
          </span>
        )}
      </CardContent>
    </Card>
  );
}
