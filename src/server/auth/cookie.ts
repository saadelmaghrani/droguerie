// Réglages du cookie de session admin.
// Fichier volontairement SANS dépendance (ni base, ni « server-only ») :
// il est importé par proxy.ts, qui s'exécute avant chaque requête /admin.

export const SESSION_COOKIE_NAME = "admin_session";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Durée de vie d'une session sans activité. */
export const SESSION_DURATION_MS = 7 * DAY_MS;

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true, // illisible par JavaScript : protège contre le vol par XSS
    secure: process.env.NODE_ENV === "production", // HTTPS uniquement en production
    sameSite: "lax" as const, // non envoyé par les formulaires d'autres sites (CSRF)
    path: "/admin", // envoyé uniquement aux pages d'administration
    expires,
  };
}

/**
 * Cookie « appareil du magasin » : posé à la connexion admin, valable sur TOUT le site et 1 an.
 * Il ne contient aucun secret (valeur « 1 ») et sert uniquement à exclure des statistiques les
 * visites faites depuis les appareils du magasin (le cookie de session, lui, n'est envoyé qu'à /admin).
 */
export const STATS_IGNORE_COOKIE_NAME = "stats_ignore";

export function statsIgnoreCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  };
}
