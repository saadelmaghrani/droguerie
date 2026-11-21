// Hachage des mots de passe avec argon2id (recommandation OWASP).
// Utilisé par le seed (création du compte admin) et, plus tard, par la connexion.
// Le mot de passe en clair n'est jamais stocké : seul le hachage l'est.
import { hash, verify } from "@node-rs/argon2";

export const PASSWORD_MIN_LENGTH = 12;

export function hashPassword(plain: string): Promise<string> {
  // Paramètres par défaut de @node-rs/argon2 : argon2id, 19 Mio de mémoire, 2 itérations.
  return hash(plain);
}

export function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  return verify(passwordHash, plain);
}
