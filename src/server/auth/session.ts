// Gestion des sessions admin en base de données.
//
// Principe (cf. guide Next.js « Database Sessions » et The Copenhagen Book) :
//   - le navigateur reçoit un JETON aléatoire de 256 bits (cookie httpOnly) ;
//   - la base stocke uniquement l'EMPREINTE SHA-256 de ce jeton ;
//   - à chaque requête, on recalcule l'empreinte et on cherche la session.
// Une fuite de la base ne donne donc aucun jeton utilisable.
import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { SESSION_DURATION_MS } from "./cookie";

/** Si la session expire dans moins de ce délai, on la prolonge (session « glissante »). */
const RENEW_THRESHOLD_MS = SESSION_DURATION_MS / 2;

/** Un jeton valide fait 43 caractères (32 octets en base64url). */
const MAX_TOKEN_LENGTH = 64;

export type SessionAdmin = { id: string; name: string; email: string };

function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  adminUserId: string,
  meta: { ipAddress: string; userAgent: string | null },
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.adminSession.create({
    data: {
      id: hashSessionToken(token),
      adminUserId,
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
    },
  });

  return { token, expiresAt };
}

/**
 * Vérifie un jeton. Renvoie l'admin connecté, ou null si la session est
 * inconnue, expirée, ou si le compte a été désactivé.
 */
export async function validateSessionToken(token: string): Promise<SessionAdmin | null> {
  if (!token || token.length > MAX_TOKEN_LENGTH) return null;

  const id = hashSessionToken(token);
  const session = await prisma.adminSession.findUnique({
    where: { id },
    include: { adminUser: { select: { id: true, name: true, email: true, isActive: true } } },
  });
  if (!session) return null;

  const now = Date.now();
  if (now >= session.expiresAt.getTime() || !session.adminUser.isActive) {
    await prisma.adminSession.deleteMany({ where: { id } });
    return null;
  }

  // Session glissante : un admin actif ne se fait pas déconnecter en pleine utilisation.
  if (session.expiresAt.getTime() - now < RENEW_THRESHOLD_MS) {
    await prisma.adminSession.update({
      where: { id },
      data: { expiresAt: new Date(now + SESSION_DURATION_MS) },
    });
  }

  const { id: adminId, name, email } = session.adminUser;
  return { id: adminId, name, email };
}

/** Déconnexion : la session est supprimée côté serveur (le jeton devient inutilisable). */
export async function invalidateSession(token: string): Promise<void> {
  if (!token || token.length > MAX_TOKEN_LENGTH) return;
  await prisma.adminSession.deleteMany({ where: { id: hashSessionToken(token) } });
}

/** Nettoyage des sessions expirées d'un admin (appelé à chaque connexion). */
export async function deleteExpiredSessions(adminUserId: string): Promise<void> {
  await prisma.adminSession.deleteMany({
    where: { adminUserId, expiresAt: { lt: new Date() } },
  });
}
