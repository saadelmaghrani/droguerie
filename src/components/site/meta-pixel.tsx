"use client";

// Meta (Facebook) Pixel — site public uniquement (monté par app/(site)/layout.tsx, jamais dans /admin).
// Rendu seulement si un identifiant valide est activé dans les Paramètres : sinon rien n'est chargé.
//
// Événements envoyés :
//   - PageView    : à l'arrivée puis à chaque changement de page (navigation sans rechargement) ;
//   - ViewContent : ouverture d'une fiche produit (<PixelViewContent />) ;
//   - Contact     : clic sur un bouton/lien WhatsApp (méthode « whatsapp »).
// Comme pour nos statistiques, « Ne pas me suivre » (Do Not Track / GPC) est respecté.
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue: unknown[][]; loaded: boolean; version: string; push: unknown; disablePushState?: boolean };
type PixelWindow = Window & { fbq?: Fbq; _fbq?: Fbq; __pixelQueue?: unknown[][] };

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

/** Envoie un événement ; s'il arrive avant le chargement du Pixel, il est mis en attente. */
export function trackPixel(event: string, params?: Record<string, unknown>) {
  const w = window as PixelWindow;
  const call = ["track", event, ...(params ? [params] : [])];
  if (w.fbq) w.fbq(...call);
  else (w.__pixelQueue ??= []).push(call);
}

/** Code d'installation officiel de Meta, réécrit en TypeScript (file d'attente + script asynchrone). */
function installPixel(pixelId: string) {
  const w = window as PixelWindow;
  if (w.fbq) return;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  // Les changements de page sont envoyés par nous (sinon Meta les compterait une 2e fois).
  fbq.disablePushState = true;
  w.fbq = fbq;
  w._fbq ??= fbq;
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  // Pas de collecte automatique des boutons/formulaires de la page : seulement nos événements.
  fbq("set", "autoConfig", false, pixelId);
  fbq("init", pixelId);
}

export function MetaPixel({ pixelId }: { pixelId: string }) {
  const pathname = usePathname();
  const enabled = useRef<boolean | null>(null);
  const lastPage = useRef<{ path: string; at: number } | null>(null);

  useEffect(() => {
    enabled.current ??= !optedOut();
    if (!enabled.current) return;
    installPixel(pixelId);
    const w = window as PixelWindow;
    // Évite le double envoi (mode développement de React, double rendu).
    const now = Date.now();
    if (lastPage.current?.path !== pathname || now - lastPage.current.at > 2000) w.fbq!("track", "PageView");
    lastPage.current = { path: pathname, at: now };
    // Événements demandés avant l'installation (ex. ViewContent d'une fiche ouverte directement).
    for (const call of w.__pixelQueue?.splice(0) ?? []) w.fbq!(...call);
  }, [pixelId, pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href^="https://wa.me/"]');
      if (link && enabled.current) trackPixel("Contact", { method: "whatsapp", page: window.location.pathname });
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}

/** À placer sur la fiche produit : « ViewContent » à chaque produit affiché. */
export function PixelViewContent({ id, name, category }: { id: string; name: string; category: string }) {
  useEffect(() => {
    // Après le PageView de la même navigation (les effets de la page passent avant ceux de la mise en page).
    const timer = setTimeout(() => {
      if (!optedOut()) trackPixel("ViewContent", { content_ids: [id], content_name: name, content_category: category, content_type: "product" });
    }, 0);
    return () => clearTimeout(timer);
  }, [id, name, category]);
  return null;
}
