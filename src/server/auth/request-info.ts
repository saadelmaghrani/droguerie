import "server-only";

import { headers } from "next/headers";

/**
 * Adresse IP et navigateur du visiteur.
 *
 * En production, Caddy (reverse proxy) transmet l'IP réelle dans X-Forwarded-For.
 * Caddy ignore par défaut un X-Forwarded-For envoyé par le client, ce qui empêche
 * de falsifier son IP pour contourner la limitation des tentatives.
 * ⚠️ Ne pas exposer l'application sans Caddy devant.
 */
export async function getRequestInfo(): Promise<{ ipAddress: string; userAgent: string | null }> {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipAddress = forwardedFor || h.get("x-real-ip") || "unknown";
  return { ipAddress: ipAddress.slice(0, 64), userAgent: h.get("user-agent") };
}
