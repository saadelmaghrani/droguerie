// Enregistrement d'un événement de visite (appelé par /api/events). Voir src/lib/analytics.ts
// pour les règles de respect de la vie privée (aucun cookie, hachage quotidien, provenance réduite).
import "server-only";

import { createHash, createHmac, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { classifyPath, deviceType, moroccoDay, referrerHost, SESSION_GAP_MS } from "@/lib/analytics";
import type { AnalyticsEventType } from "@/generated/prisma/client";

export type IncomingEvent = { kind: "pageview" | "whatsapp"; path: string; referrer: string | null };
export type RequestInfo = { ip: string; userAgent: string; ownHost: string | null };

/** Secret du hachage : ANALYTICS_SECRET, sinon dérivé de la connexion base (stable, jamais exposé). */
function secret(): string {
  return process.env.ANALYTICS_SECRET || createHash("sha256").update(`analytics:${process.env.DATABASE_URL ?? ""}`).digest("hex");
}

/** Identifiant anonyme du visiteur pour la journée (change chaque jour). */
export function visitorHash(ip: string, userAgent: string, now = new Date()): string {
  const daySalt = createHmac("sha256", secret()).update(moroccoDay(now)).digest("hex");
  return createHash("sha256").update(`${daySalt}|${ip}|${userAgent}`).digest("hex").slice(0, 32);
}

// Limite de débit (mémoire du serveur) : 60 événements par minute et par visiteur.
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 60;
}

/** Visite (session) en cours du visiteur, ou nouvelle visite après 30 minutes d'inactivité. */
async function sessionFor(visitor: string): Promise<string> {
  const last = await prisma.analyticsEvent.findFirst({
    where: { visitorHash: visitor, createdAt: { gt: new Date(Date.now() - SESSION_GAP_MS) } },
    orderBy: { createdAt: "desc" },
    select: { sessionId: true },
  });
  return last?.sessionId ?? randomUUID();
}

/** Produit / catégorie VISIBLES correspondant à l'adresse (les brouillons ne sont pas comptés). */
async function resolveTarget(path: string): Promise<{ productId: string | null; categoryId: string | null; found: boolean }> {
  const page = classifyPath(path);
  if (page.kind === "product") {
    const product = await prisma.product.findFirst({
      where: { slug: page.slug, status: "PUBLISHED", category: { isActive: true } },
      select: { id: true, categoryId: true },
    });
    return { productId: product?.id ?? null, categoryId: product?.categoryId ?? null, found: Boolean(product) };
  }
  if (page.kind === "category") {
    const category = await prisma.category.findFirst({ where: { slug: page.slug, isActive: true }, select: { id: true } });
    return { productId: null, categoryId: category?.id ?? null, found: Boolean(category) };
  }
  return { productId: null, categoryId: null, found: true };
}

export async function recordEvent(event: IncomingEvent, request: RequestInfo): Promise<"recorded" | "ignored"> {
  const visitor = visitorHash(request.ip, request.userAgent);
  if (rateLimited(visitor)) return "ignored";
  const page = classifyPath(event.path);
  const target = await resolveTarget(event.path);
  if (!target.found) return "ignored"; // page introuvable : non comptée

  const base = {
    visitorHash: visitor,
    sessionId: await sessionFor(visitor),
    path: event.path,
    referrer: event.kind === "pageview" ? referrerHost(event.referrer, request.ownHost) : null,
    deviceType: deviceType(request.userAgent),
    productId: target.productId,
    categoryId: target.categoryId,
  };
  const types: AnalyticsEventType[] =
    event.kind === "whatsapp"
      ? ["WHATSAPP_CLICK"]
      : ["PAGE_VIEW", ...(page.kind === "product" ? (["PRODUCT_VIEW"] as const) : page.kind === "category" ? (["CATEGORY_VIEW"] as const) : [])];
  await prisma.analyticsEvent.createMany({ data: types.map((type) => ({ ...base, type })) });
  return "recorded";
}
