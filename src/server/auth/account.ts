// Gestion du compte administrateur : nom, mot de passe, email de connexion.
// Utilisé par les actions de la page « Mon compte » et par la commande de secours
// `npm run admin:reset-password` (scripts/reset-admin-password.ts).
import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isLoginBlocked, recordLoginAttempt } from "./rate-limit";
import { deleteOtherSessions } from "./session";

export type CurrentPasswordCheck = "ok" | "wrong" | "blocked";

/**
 * Vérifie le mot de passe actuel avant une modification sensible.
 * Un échec compte comme une tentative de connexion ratée (même blocage de 15 minutes) :
 * une session volée ne permet donc pas de deviner le mot de passe à l'infini.
 */
export async function checkCurrentPassword(
  admin: { id: string; email: string },
  plain: string,
  ipAddress: string,
): Promise<CurrentPasswordCheck> {
  if (await isLoginBlocked(admin.email, ipAddress)) return "blocked";
  const row = await prisma.adminUser.findUnique({ where: { id: admin.id }, select: { passwordHash: true } });
  const ok = row ? await verifyPassword(row.passwordHash, plain) : false;
  if (!ok) await recordLoginAttempt(admin.email, ipAddress, false);
  return ok ? "ok" : "wrong";
}

export async function updateAdminName(adminId: string, name: string): Promise<void> {
  await prisma.adminUser.update({ where: { id: adminId }, data: { name } });
}

/** Nouveau mot de passe ; les autres appareils sont déconnectés (sauf la session `keepToken`). */
export async function updateAdminPassword(adminId: string, newPassword: string, keepToken: string | null): Promise<number> {
  const passwordHash = await hashPassword(newPassword);
  await prisma.adminUser.update({ where: { id: adminId }, data: { passwordHash } });
  return deleteOtherSessions(adminId, keepToken);
}

export type EmailChangeResult = { ok: true; signedOut: number } | { ok: false; reason: "same" | "taken" };

/**
 * Nouvel email de connexion. La session est liée à l'identifiant du compte, pas à l'email :
 * la session en cours reste valide ; les autres appareils sont déconnectés.
 */
export async function updateAdminEmail(
  adminId: string,
  currentEmail: string,
  newEmail: string,
  keepToken: string | null,
): Promise<EmailChangeResult> {
  if (newEmail === currentEmail) return { ok: false, reason: "same" };
  const owner = await prisma.adminUser.findUnique({ where: { email: newEmail }, select: { id: true } });
  if (owner) return { ok: false, reason: "taken" };
  try {
    await prisma.adminUser.update({ where: { id: adminId }, data: { email: newEmail } });
  } catch (error) {
    // Course rare : l'email a été pris entre la vérification et l'enregistrement.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, reason: "taken" };
    }
    throw error;
  }
  return { ok: true, signedOut: await deleteOtherSessions(adminId, keepToken) };
}

/**
 * Commande de secours (mot de passe oublié) : nouveau mot de passe, compte réactivé,
 * TOUTES les sessions supprimées, blocage anti-force brute levé pour cet email.
 * Renvoie false si aucun compte n'a cet email.
 */
export async function resetAdminPassword(email: string, newPassword: string): Promise<boolean> {
  const admin = await prisma.adminUser.findUnique({ where: { email }, select: { id: true } });
  if (!admin) return false;
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.adminUser.update({ where: { id: admin.id }, data: { passwordHash, isActive: true } }),
    prisma.adminSession.deleteMany({ where: { adminUserId: admin.id } }),
    prisma.loginAttempt.deleteMany({ where: { email, success: false } }),
  ]);
  return true;
}
