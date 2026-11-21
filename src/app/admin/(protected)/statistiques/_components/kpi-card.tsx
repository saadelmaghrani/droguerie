// Grand indicateur : titre + aide « ? », valeur en grand avec unité, tendance vs période précédente
// (flèche + texte, jamais la couleur seule).
import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleHelp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Part = { value: string; unit?: string };

export function KpiCard({ title, help, parts, change }: { title: string; help: string; parts: Part[]; change?: number | null }) {
  const Icon = change == null ? null : change > 0 ? ArrowUpRight : change < 0 ? ArrowDownRight : ArrowRight;
  const helpId = `help-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <Card className="h-full">
      <CardContent className="grid h-full content-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <span className="group relative">
            <button type="button" aria-describedby={helpId} className="rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Définition : ${title}`}>
              <CircleHelp className="size-4" aria-hidden />
            </button>
            <span
              id={helpId}
              role="tooltip"
              className="pointer-events-none absolute top-6 right-0 z-20 w-60 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground opacity-0 shadow-md transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
            >
              {help}
            </span>
          </span>
        </div>
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {parts.map((part, i) => (
            <span key={i} className="flex items-baseline gap-1.5">
              {i > 0 && <span className="text-3xl font-light text-muted-foreground" aria-hidden>/</span>}
              <span className="text-4xl font-semibold tabular-nums tracking-tight">{part.value}</span>
              {part.unit && <span className="text-sm text-muted-foreground">{part.unit}</span>}
            </span>
          ))}
        </p>
        {change !== undefined && (
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            {Icon && <Icon className="size-4" aria-hidden />}
            {change == null ? "Pas de comparaison possible" : `${change > 0 ? "+" : ""}${change} % vs période précédente`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
