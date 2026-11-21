"use client";

// Mesure d'audience sans cookie : une « page vue » à chaque changement d'adresse, et un « clic WhatsApp »
// sur tout lien wa.me. Envoi par navigator.sendBeacon (n'attend pas de réponse, ne ralentit pas la page).
// Le navigateur qui demande « Ne pas me suivre » (Do Not Track / GPC) n'est pas compté.
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

function send(payload: { t: "pageview" | "whatsapp"; p: string; r?: string }) {
  const body = new Blob([JSON.stringify(payload)], { type: "application/json" });
  if (!navigator.sendBeacon?.("/api/events", body)) {
    void fetch("/api/events", { method: "POST", body, keepalive: true }).catch(() => {});
  }
}

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

export function AnalyticsTracker() {
  const pathname = usePathname();
  const lastSent = useRef<{ path: string; at: number } | null>(null);
  const firstView = useRef(true);

  useEffect(() => {
    if (optedOut()) return;
    const now = Date.now();
    // Évite le double envoi (mode développement de React, double rendu).
    if (lastSent.current?.path === pathname && now - lastSent.current.at < 2000) return;
    lastSent.current = { path: pathname, at: now };
    // Provenance : seulement à l'arrivée sur le site (ensuite, c'est une navigation interne).
    send({ t: "pageview", p: pathname, ...(firstView.current && document.referrer ? { r: document.referrer } : {}) });
    firstView.current = false;
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href^="https://wa.me/"]');
      if (link && !optedOut()) send({ t: "whatsapp", p: window.location.pathname });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
