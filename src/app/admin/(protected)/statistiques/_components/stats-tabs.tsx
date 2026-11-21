"use client";

// Onglets (évolution : visites / consultations / clics ; classements : produits / catégories).
import { useState } from "react";
import { cn } from "@/lib/utils";

export function Tabs({ label, tabs }: { label: string; tabs: { key: string; label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  if (!current) return null;
  return (
    <div className="grid gap-4">
      {tabs.length > 1 && (
        <div role="tablist" aria-label={label} className="flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={t.key === current.key}
              aria-controls={`panel-${t.key}`}
              onClick={() => setActive(t.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                t.key === current.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div role="tabpanel" id={`panel-${current.key}`} aria-labelledby={`tab-${current.key}`}>
        {current.content}
      </div>
    </div>
  );
}
