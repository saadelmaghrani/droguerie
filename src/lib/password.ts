// Hachage des mots de passe avec argon2id (recommandation OWASP).
// Utilisé par le seed, la connexion, la page « Mon compte » et la commande de secours.
// Le mot de passe en clair n'est jamais stocké : seul le hachage l'est.
import { hash, verify } from "@node-rs/argon2";

export { PASSWORD_MIN_LENGTH } from "./password-rules";

export function hashPassword(plain: string): Promise<string> {
  // Paramètres par défaut de @node-rs/argon2 : argon2id, 19 Mio de mémoire, 2 itérations.
  return hash(plain);
}

export function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  return verify(passwordHash, plain);
}
