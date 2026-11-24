"use server";
// Actions de la page « Mon compte ». Points d'entrée publics : requireAdmin() en premier.
// Le mot de passe actuel est redemandé pour le mot de passe et l'email (une session restée ouverte
// sur un appareil ne suffit pas pour prendre le contrôle du compte).

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import {
  emailChangeSchema,
  firstErrors,
  nameSchema,
  passwordChangeSchema,
  type FieldErrors,
} from "@/lib/account-validation";
import { checkCurrentPassword, updateAdminEmail, updateAdminName, updateAdminPassword } from "./account";
import { SESSION_COOKIE_NAME } from "./cookie";
import { requireAdmin } from "./dal";
import { LOCKOUT_MINUTES } from "./rate-limit";
import { getRequestInfo } from "./request-info";

type State<K extends string> =
  | { ok: true; message: string; submissionId: number }
  | { ok: false; message: string; fieldErrors: FieldErrors<K>; submissionId: number }
  | undefined;

export type NameFormState = State<"name">;
export type PasswordFormState = State<"currentPassword" | "newPassword" | "confirmPassword">;
export type EmailFormState = State<"currentPassword" | "newEmail">;

const read = (formData: FormData, key: string) => String(formData.get(key) ?? "").slice(0, 1000);
const INVALID = "Vérifiez les champs signalés.";
const WRONG_PASSWORD = "Mot de passe actuel incorrect.";
const BLOCKED = `Trop de tentatives. Réessayez dans ${LOCKOUT_MINUTES} minutes.`;

function signedOutNote(count: number): string {
  if (count === 0) return "";
  return count === 1 ? " L'autre appareil connecté a été déconnecté." : ` Les ${count} autres appareils connectés ont été déconnectés.`;
}

async function currentToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function updateNameAction(_previous: NameFormState, formData: FormData): Promise<NameFormState> {
  const admin = await requireAdmin();
  const submissionId = Date.now();
  const parsed = nameSchema.safeParse({ name: read(formData, "name") });
  if (!parsed.success) return { ok: false, message: INVALID, fieldErrors: firstErrors(parsed.error), submissionId };

  await updateAdminName(admin.id, parsed.data.name);
  refresh(); // le nom affiché dans le menu se met à jour
  return { ok: true, message: "Nom enregistré.", submissionId };
}

export async function changePasswordAction(_previous: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  const admin = await requireAdmin();
  const submissionId = Date.now();
  const parsed = passwordChangeSchema.safeParse({
    currentPassword: read(formData, "currentPassword"),
    newPassword: read(formData, "newPassword"),
    confirmPassword: read(formData, "confirmPassword"),
  });
  if (!parsed.success) return { ok: false, message: INVALID, fieldErrors: firstErrors(parsed.error), submissionId };

  const { ipAddress } = await getRequestInfo();
  const check = await checkCurrentPassword(admin, parsed.data.currentPassword, ipAddress);
  if (check === "blocked") return { ok: false, message: BLOCKED, fieldErrors: {}, submissionId };
  if (check === "wrong") {
    return { ok: false, message: WRONG_PASSWORD, fieldErrors: { currentPassword: WRONG_PASSWORD }, submissionId };
  }

  const signedOut = await updateAdminPassword(admin.id, parsed.data.newPassword, await currentToken());
  return { ok: true, message: `Mot de passe modifié.${signedOutNote(signedOut)}`, submissionId };
}

export async function changeEmailAction(_previous: EmailFormState, formData: FormData): Promise<EmailFormState> {
  const admin = await requireAdmin();
  const submissionId = Date.now();
  const parsed = emailChangeSchema.safeParse({
    currentPassword: read(formData, "currentPassword"),
    newEmail: read(formData, "newEmail"),
  });
  if (!parsed.success) return { ok: false, message: INVALID, fieldErrors: firstErrors(parsed.error), submissionId };

  const { ipAddress } = await getRequestInfo();
  const check = await checkCurrentPassword(admin, parsed.data.currentPassword, ipAddress);
  if (check === "blocked") return { ok: false, message: BLOCKED, fieldErrors: {}, submissionId };
  if (check === "wrong") {
    return { ok: false, message: WRONG_PASSWORD, fieldErrors: { currentPassword: WRONG_PASSWORD }, submissionId };
  }

  const result = await updateAdminEmail(admin.id, admin.email, parsed.data.newEmail, await currentToken());
  if (!result.ok) {
    const message =
      result.reason === "same" ? "C'est déjà votre email de connexion." : "Cette adresse est déjà utilisée par un autre compte.";
    return { ok: false, message, fieldErrors: { newEmail: message }, submissionId };
  }
  refresh(); // l'email affiché dans le menu se met à jour
  return {
    ok: true,
    message: `Email modifié : utilisez ${parsed.data.newEmail} à la prochaine connexion.${signedOutNote(result.signedOut)}`,
    submissionId,
  };
}
