// Limitation des tentatives de connexion (protection contre la force brute).
// Stockée en base : survit aux redémarrages de l'application.
import "server-only";

import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000; // fenêtre d'observation : 15 minutes
const MAX_FAILURES_PER_EMAIL = 5; // par compte visé
const MAX_FAILURES_PER_IP = 20; // par adresse IP (attaque sur plusieurs emails)
const RETENTION_MS = 24 * 60 * 60 * 1000; // historique conservé 24 h

export const LOCKOUT_MINUTES = WINDOW_MS / 60_000;

export async function isLoginBlocked(email: string, ipAddress: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS);
  const [failuresForEmail, failuresForIp] = await Promise.all([
    prisma.loginAttempt.count({ where: { email, success: false, createdAt: { gte: since } } }),
    prisma.loginAttempt.count({ where: { ipAddress, success: false, createdAt: { gte: since } } }),
  ]);
  return failuresForEmail >= MAX_FAILURES_PER_EMAIL || failuresForIp >= MAX_FAILURES_PER_IP;
}

export async function recordLoginAttempt(
  email: string,
  ipAddress: string,
  success: boolean,
): Promise<void> {
  await prisma.loginAttempt.create({ data: { email, ipAddress, success } });

  if (success) {
    // Nettoyage opportuniste de l'historique ancien.
    await prisma.loginAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } },
    });
  }
}
