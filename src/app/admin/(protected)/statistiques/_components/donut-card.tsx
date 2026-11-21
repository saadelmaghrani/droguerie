"use client";

// Anneau de répartition (appareils, provenance) + légende en tuiles (nombre et %).
// Palette catégorielle validée (4 teintes, ordre fixe) ; au-delà de 4 parts : « Autres » en gris neutre.
// Les libellés restent visibles (2 teintes sont peu contrastées sur fond clair) ; survol = détail au centre.
import { useState } from "react";

export const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"] as const;
const OTHER = "#9c9b95";
const SIZE = 168;
const STROKE = 26;

export type Slice = { label: string; value: number };

/** 4 parts au maximum : les suivantes sont regroupées dans « Autres ». */
export function foldSlices(slices: Slice[], max = 4): (Slice & { color: string })[] {
  const sorted = [...slices].filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, sorted.length > max ? max - 1 : max).map((s, i) => ({ ...s, color: CATEGORICAL[i]! }));
  const rest = sorted.slice(head.length);
  return rest.length ? [...head, { label: "Autres", value: rest.reduce((a, s) => a + s.value, 0), color: OTHER }] : head;
}

export function DonutCardBody({ slices, unit, emptyText }: { slices: Slice[]; unit: string; emptyText: string }) {
  const parts = foldSlices(slices);
  const total = parts.reduce((a, s) => a + s.value, 0);
  const [hover, setHover] = useState<number | null>(null);
  if (total === 0) return <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>;

  const r = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const gap = parts.length > 1 ? 2 : 0; // 2 px de séparation entre les parts
  // Position de départ de chaque part (cumul des longueurs précédentes), calculée avant le rendu.
  const lengths = parts.map((p) => (p.value / total) * circumference);
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, l) => a + l, 0));
  const pct = (v: number) => `${((v / total) * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
  const active = hover !== null ? parts[hover] : null;

  return (
    <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
      <div className="relative mx-auto size-[168px]">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={parts.map((p) => `${p.label} ${pct(p.value)}`).join(", ")} className="-rotate-90">
          {parts.map((p, i) => {
            const dash = Math.max(lengths[i]! - gap, 0.5);
            return (
              <circle
                key={p.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={r}
                fill="none"
                stroke={p.color}
                strokeWidth={hover === i ? STROKE + 4 : STROKE}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-starts[i]!}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                className="cursor-default transition-[stroke-width]"
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center" aria-live="polite">
          <span className="text-2xl font-semibold tabular-nums">{(active?.value ?? total).toLocaleString("fr-FR")}</span>
          <span className="max-w-24 truncate text-xs text-muted-foreground">{active ? active.label : `${unit} au total`}</span>
        </div>
      </div>
      <ul className="grid min-w-0 gap-1.5">
        {parts.map((p, i) => (
          <li
            key={p.label}
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            className={`flex items-center gap-3 rounded-lg p-2 transition-colors ${hover === i ? "bg-muted" : ""}`}
          >
            <span className="size-8 shrink-0 rounded-md" style={{ background: p.color }} aria-hidden />
            <span className="grid min-w-0">
              <span className="truncate text-sm text-muted-foreground">{p.label}</span>
              <span className="flex items-baseline gap-2 whitespace-nowrap">
                <span className="text-lg font-semibold tabular-nums">{p.value.toLocaleString("fr-FR")}</span>
                <span className="text-sm tabular-nums text-muted-foreground">{pct(p.value)}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
