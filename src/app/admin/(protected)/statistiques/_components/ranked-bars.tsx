// Classement (barres horizontales, une seule teinte, la plus grande en premier).
// Colonnes : consultations (barre + valeur), clics WhatsApp, taux de contact.
import { ExternalLink } from "lucide-react";
import type { RankedRow } from "@/server/analytics/stats";

const SERIES = "#2a78d6";

export function RankedBars({ rows, viewsLabel, empty }: { rows: RankedRow[]; viewsLabel: string; empty: string }) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.views), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th className="py-2 pr-3 font-medium">Nom</th>
            <th className="py-2 pr-3 text-right font-medium sm:w-[40%] sm:text-left">{viewsLabel}</th>
            <th className="py-2 pr-3 text-right font-medium">
              <span className="sm:hidden">Clics</span>
              <span className="hidden sm:inline">Clics WhatsApp</span>
            </th>
            <th className="hidden py-2 text-right font-medium sm:table-cell" title="Clics WhatsApp ÷ consultations">Taux</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, i) => (
            <tr key={row.id ?? i}>
              <td className="max-w-40 py-2 pr-3 sm:max-w-56">
                {row.href ? (
                  <a href={row.href} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 hover:underline">
                    <span className="truncate">{row.name}</span>
                    <ExternalLink className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                  </a>
                ) : (
                  <span className="text-muted-foreground">{row.name}</span>
                )}
              </td>
              <td className="py-2 pr-3">
                <div className="flex items-center justify-end gap-2 sm:justify-start">
                  <div className="hidden h-2.5 flex-1 overflow-hidden rounded-full bg-muted/60 sm:block">
                    <div className="h-full rounded-full" style={{ width: `${(row.views / max) * 100}%`, background: SERIES }} />
                  </div>
                  <span className="text-right tabular-nums sm:w-12">{row.views.toLocaleString("fr-FR")}</span>
                </div>
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">{row.clicks.toLocaleString("fr-FR")}</td>
              <td className="hidden py-2 text-right tabular-nums text-muted-foreground sm:table-cell">
                {row.views ? `${((row.clicks / row.views) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Répartition simple (appareils, provenance) : barres + pourcentage. */
export function ShareBars({ rows }: { rows: { label: string; value: number }[] }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (total === 0) return <p className="py-4 text-center text-sm text-muted-foreground">Pas encore de données.</p>;
  return (
    <ul className="grid gap-2.5 text-sm">
      {rows.map((r) => {
        const pct = (r.value / total) * 100;
        return (
          <li key={r.label} className="grid gap-1">
            <div className="flex justify-between gap-2">
              <span className="truncate">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {pct.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} % · {r.value.toLocaleString("fr-FR")}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/60">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: SERIES }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
