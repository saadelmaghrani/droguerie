"use client";

// Courbe d'une seule mesure dans le temps (une seule couleur : le titre nomme la série, pas de légende).
// Survol / toucher : ligne verticale + point + infobulle. Les données exactes sont aussi dans un tableau.
import { useEffect, useMemo, useRef, useState } from "react";
import { formatBucket } from "@/lib/format-period";

const SERIES = "#2a78d6"; // teinte catégorielle 1 de la palette de référence (bleu)
const DEFAULT_HEIGHT = 168;
const PAD = { top: 12, right: 12, bottom: 26, left: 40 };

export type TrendPoint = { bucket: string; value: number };

function niceMax(max: number): number {
  if (max <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pow;
}

export function TrendChart({
  title,
  unitLabel,
  points,
  unit,
  height: HEIGHT = DEFAULT_HEIGHT,
}: {
  title: string;
  unitLabel: string;
  points: TrendPoint[];
  unit: "day" | "month";
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Largeur mesurée sur le conteneur (ResizeObserver). Valeur de départ petite : un graphique ne doit
  // jamais élargir sa colonne (sinon il se mesure lui-même et ne rétrécit plus).
  const [width, setWidth] = useState(280);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry!.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const innerW = width - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const { line, area } = useMemo(() => {
    const coords = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`);
    return {
      line: `M${coords.join(" L")}`,
      area: `M${x(0).toFixed(1)},${y(0)} L${coords.join(" L")} L${x(points.length - 1).toFixed(1)},${y(0)} Z`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend de la largeur et des points
  }, [points, width, max]);

  const ticks = [0, max / 2, max];
  const labelIdx = points.length <= 1 ? [0] : [0, Math.floor((points.length - 1) / 2), points.length - 1];
  const total = points.reduce((sum, p) => sum + p.value, 0);

  function onPointer(event: React.PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const i = Math.round(((px - PAD.left) / innerW) * (points.length - 1));
    setHover(Math.max(0, Math.min(points.length - 1, i)));
  }

  const active = hover !== null ? points[hover] : null;
  return (
    <figure className="grid min-w-0 gap-2">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground tabular-nums">Total : {total.toLocaleString("fr-FR")}</span>
      </figcaption>
      <div ref={ref} className="relative min-w-0 overflow-hidden">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`${title} : ${total.toLocaleString("fr-FR")} sur la période, maximum ${Math.max(0, ...points.map((p) => p.value))} par ${unit === "month" ? "mois" : "jour"}.`}
          className="block touch-pan-y select-none"
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="#e7e7e4" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="#6b6a65" className="tabular-nums">
                {t.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
              </text>
            </g>
          ))}
          {labelIdx.map((i) => (
            <text key={i} x={x(i)} y={HEIGHT - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize={11} fill="#6b6a65">
              {points[i] ? formatBucket(points[i]!.bucket, unit) : ""}
            </text>
          ))}
          <path d={area} fill={SERIES} fillOpacity={0.1} />
          <path d={line} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {active && hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="#9c9b95" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={x(hover)} cy={y(active.value)} r={5} fill={SERIES} stroke="#ffffff" strokeWidth={2} />
            </g>
          )}
        </svg>
        {active && hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: Math.min(Math.max(x(hover) - 70, 0), width - 140), width: 140 }}
          >
            <div className="text-muted-foreground">{formatBucket(active.bucket, unit, true)}</div>
            <div className="font-medium tabular-nums text-foreground">
              {active.value.toLocaleString("fr-FR")} {unitLabel}
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
