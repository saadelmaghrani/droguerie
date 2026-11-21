// Couche d'accès (« Data Access Layer ») de l'authentification.
//
// RÈGLE DU PROJET : toute page admin et toute action serveur admin appelle
// requireAdmin() AVANT de lire ou modifier des données. proxy.ts ne fait
// qu'une vérification rapide (présence du cookie) : ce n'est pas une sécurité suffisante.
import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "./cookie";
import { validateSessionToken, type SessionAdmin } from "./session";

/**
 * Admin connecté, ou null. `cache` évite de refaire la requête SQL si plusieurs
 * composants de la même page l'appellent.
 */
export const getCurrentAdmin = cache(async (): Promise<SessionAdmin | null> => {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return validateSessionToken(token);
});

/** Admin connecté ; sinon redirection vers la page de connexion. */
export async function requireAdmin(): Promise<SessionAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
