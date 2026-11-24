import { describe, expect, it } from "vitest";
import { emailChangeSchema, firstErrors, nameSchema, passwordChangeSchema } from "./account-validation";

const errorsOf = (result: { success: boolean; error?: unknown }) =>
  result.success ? {} : firstErrors(result.error as Parameters<typeof firstErrors>[0]);

describe("nameSchema", () => {
  it("retire les espaces et accepte un nom normal", () => {
    expect(nameSchema.parse({ name: "  Saïd Alaoui " })).toEqual({ name: "Saïd Alaoui" });
  });
  it("refuse un nom trop court ou trop long", () => {
    expect(nameSchema.safeParse({ name: " a " }).success).toBe(false);
    expect(nameSchema.safeParse({ name: "x".repeat(61) }).success).toBe(false);
  });
});

describe("passwordChangeSchema", () => {
  const valid = { currentPassword: "ancien-mot-de-passe", newPassword: "nouvelle phrase secrète", confirmPassword: "nouvelle phrase secrète" };

  it("accepte un changement valide", () => {
    expect(passwordChangeSchema.safeParse(valid).success).toBe(true);
  });
  it("exige le mot de passe actuel", () => {
    expect(errorsOf(passwordChangeSchema.safeParse({ ...valid, currentPassword: "" }))).toHaveProperty("currentPassword");
  });
  it("exige 12 caractères minimum", () => {
    const short = "Court1!abcd"; // 11
    const errors = errorsOf(passwordChangeSchema.safeParse({ ...valid, newPassword: short, confirmPassword: short }));
    expect(errors.newPassword).toMatch(/12 caractères/);
  });
  it("accepte exactement 12 caractères", () => {
    const pw = "abcdefghijk1";
    expect(passwordChangeSchema.safeParse({ ...valid, newPassword: pw, confirmPassword: pw }).success).toBe(true);
  });
  it("refuse un mot de passe trop long (> 256)", () => {
    const long = "ab".repeat(129);
    expect(passwordChangeSchema.safeParse({ ...valid, newPassword: long, confirmPassword: long }).success).toBe(false);
  });
  it("refuse un mot de passe répétitif", () => {
    const weak = "aaaaaaaaaaaaaaaa";
    expect(errorsOf(passwordChangeSchema.safeParse({ ...valid, newPassword: weak, confirmPassword: weak })).newPassword).toMatch(/simple/);
  });
  it("refuse des espaces au début ou à la fin", () => {
    const pw = " nouvelle phrase secrète";
    expect(passwordChangeSchema.safeParse({ ...valid, newPassword: pw, confirmPassword: pw }).success).toBe(false);
  });
  it("signale une confirmation différente sur le champ de confirmation", () => {
    const errors = errorsOf(passwordChangeSchema.safeParse({ ...valid, confirmPassword: "autre chose 123" }));
    expect(errors.confirmPassword).toMatch(/pas identiques/);
    expect(errors.newPassword).toBeUndefined();
  });
  it("refuse de garder le même mot de passe", () => {
    const same = { currentPassword: "meme-mot-de-passe", newPassword: "meme-mot-de-passe", confirmPassword: "meme-mot-de-passe" };
    expect(errorsOf(passwordChangeSchema.safeParse(same)).newPassword).toMatch(/différent/);
  });
});

describe("emailChangeSchema", () => {
  it("met l'email en minuscules et retire les espaces", () => {
    expect(emailChangeSchema.parse({ currentPassword: "x", newEmail: "  Gerant@Exemple.MA " }).newEmail).toBe("gerant@exemple.ma");
  });
  it("refuse une adresse invalide", () => {
    for (const newEmail of ["", "gerant", "gerant@", "gerant@exemple", "a b@exemple.ma"]) {
      expect(errorsOf(emailChangeSchema.safeParse({ currentPassword: "x", newEmail })).newEmail).toBeDefined();
    }
  });
  it("exige le mot de passe actuel", () => {
    expect(errorsOf(emailChangeSchema.safeParse({ currentPassword: "", newEmail: "a@b.ma" }))).toHaveProperty("currentPassword");
  });
});
