// Règles de saisie de la page « Mon compte » (logique pure, testée par account-validation.test.ts).
// Utilisées par les actions serveur ; la vérification du mot de passe ACTUEL se fait côté serveur.
import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "./password-rules";

/** Au-delà, le hachage argon2 coûterait inutilement cher (protection contre les envois géants). */
export const PASSWORD_MAX_LENGTH = 256;
export const NAME_MAX_LENGTH = 60;

const currentPassword = z
  .string()
  .min(1, "Saisissez votre mot de passe actuel.")
  .max(PASSWORD_MAX_LENGTH, "Mot de passe actuel incorrect.");

export const nameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(NAME_MAX_LENGTH, `Le nom : ${NAME_MAX_LENGTH} caractères maximum.`),
});

export const passwordChangeSchema = z
  .object({
    currentPassword,
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Le nouveau mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`)
      .max(PASSWORD_MAX_LENGTH, `Le nouveau mot de passe : ${PASSWORD_MAX_LENGTH} caractères maximum.`)
      .refine((v) => v.trim() === v, "Le mot de passe ne doit pas commencer ni finir par un espace.")
      .refine((v) => new Set(v).size >= 4, "Mot de passe trop simple : variez les caractères."),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les deux saisies du nouveau mot de passe ne sont pas identiques.",
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ["newPassword"],
    message: "Le nouveau mot de passe doit être différent de l'actuel.",
  });

export const emailChangeSchema = z.object({
  currentPassword,
  newEmail: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Adresse email trop longue.")
    .pipe(z.email("Adresse email invalide.")),
});

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

/** Première erreur de chaque champ, dans l'ordre du schéma. */
export function firstErrors<K extends string>(error: z.ZodError): FieldErrors<K> {
  const errors: FieldErrors<K> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as K | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
