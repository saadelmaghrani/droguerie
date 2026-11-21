"use server";
// Actions serveur de connexion / déconnexion, appelées par les formulaires.
// Next.js vérifie l'origine de chaque appel d'action (protection CSRF intégrée).

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "./cookie";
import { isLoginBlocked, LOCKOUT_MINUTES, recordLoginAttempt } from "./rate-limit";
import { getRequestInfo } from "./request-info";
import { createSession, deleteExpiredSessions, invalidateSession } from "./session";

export type LoginState = { error: string; email: string } | undefined;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(256),
});

// Message volontairement identique pour « email inconnu » et « mauvais mot de passe » :
// on ne révèle pas quels emails possèdent un compte.
const INVALID_CREDENTIALS = "Email ou mot de passe incorrect.";

// Hachage factice : si l'email n'existe pas, on vérifie quand même un mot de passe,
// pour que la réponse prenne le même temps (sinon le délai trahirait l'existence du compte).
let dummyHashPromise: Promise<string> | undefined;
function getDummyHash() {
  dummyHashPromise ??= hashPassword("mot-de-passe-factice-pour-egaliser-le-temps");
  return dummyHashPromise;
}

/** N'accepte qu'une redirection interne vers l'admin (pas de redirection vers un autre site). */
function safeRedirectTarget(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/admin";
  const isInternalAdminPath =
    /^\/admin(\/|\?|$)/.test(value) && !value.startsWith("/admin/login") && !value.includes("\\");
  return isInternalAdminPath ? value : "/admin";
}

export async function login(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = String(formData.get("email") ?? "").slice(0, 254);
  const parsed = loginSchema.safeParse({
    email: rawEmail,
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "Veuillez saisir un email et un mot de passe valides.", email: rawEmail };
  }
  const { email, password } = parsed.data;
  const { ipAddress, userAgent } = await getRequestInfo();

  if (await isLoginBlocked(email, ipAddress)) {
    return {
      error: `Trop de tentatives. Réessayez dans ${LOCKOUT_MINUTES} minutes.`,
      email,
    };
  }

  const admin = await prisma.adminUser.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, isActive: true },
  });
  const passwordOk = await verifyPassword(admin?.passwordHash ?? (await getDummyHash()), password);

  if (!admin || !passwordOk || !admin.isActive) {
    await recordLoginAttempt(email, ipAddress, false);
    return { error: INVALID_CREDENTIALS, email };
  }

  await recordLoginAttempt(email, ipAddress, true);

  // Une éventuelle ancienne session de ce navigateur est supprimée (pas de réutilisation).
  const cookieStore = await cookies();
  const previousToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (previousToken) await invalidateSession(previousToken);

  await deleteExpiredSessions(admin.id);
  const { token, expiresAt } = await createSession(admin.id, { ipAddress, userAgent });
  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieOptions(expiresAt));
  redirect(safeRedirectTarget(formData.get("next")));
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) await invalidateSession(token);
  // Expiration immédiate du cookie (mêmes attributs, date passée).
  cookieStore.set(SESSION_COOKIE_NAME, "", sessionCookieOptions(new Date(0)));
  redirect("/admin/login");
}
