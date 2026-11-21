import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, whatsappUrl } from "./phone";

const ok = (input: string) => {
  const result = normalizePhone(input);
  if (!result.ok) throw new Error(`« ${input} » refusé : ${result.error}`);
  return result.value;
};
const refused = (input: string) => {
  const result = normalizePhone(input);
  return result.ok ? null : result.error;
};

describe("normalizePhone — formats marocains acceptés", () => {
  it.each([
    "0612345678",
    "06 12 34 56 78",
    "06-12-34-56-78",
    "06.12.34.56.78",
    "+212612345678",
    "+212 6 12 34 56 78",
    "+212 06 12 34 56 78", // erreur fréquente : 0 après l'indicatif
    "00212612345678",
    "00212 6 12 34 56 78",
    "212612345678",
    "(+212) 612-345-678",
    "  06 12 34 56 78  ",
  ])("« %s » → 212612345678", (input) => {
    expect(ok(input)).toBe("212612345678");
  });

  it("accepte fixe (05), mobile (06, 07) et VoIP (08)", () => {
    expect(ok("0522123456")).toBe("212522123456");
    expect(ok("0712345678")).toBe("212712345678");
    expect(ok("0812345678")).toBe("212812345678");
  });
});

describe("normalizePhone — numéros étrangers", () => {
  it("accepte un numéro international avec + ou 00", () => {
    expect(ok("+33 6 12 34 56 78")).toBe("33612345678");
    expect(ok("0033612345678")).toBe("33612345678");
  });
});

describe("normalizePhone — refus", () => {
  it.each([
    ["", "vide"],
    ["   ", "espaces seuls"],
    ["06 12 34 56", "trop court"],
    ["061234567890", "trop long"],
    ["+212 9 12 34 56 78", "préfixe marocain inexistant (9)"],
    ["+212 6 12 34 56", "trop court après +212"],
    ["612345678", "sans indicatif ni 0"],
    ["06 12 AB 56 78", "lettres"],
    ["06+12345678", "+ au milieu"],
    ["++212612345678", "double +"],
    ["+0612345678", "+ suivi de 0"],
    ["+123", "international trop court"],
    ["<script>", "caractères interdits"],
  ])("refuse « %s » (%s)", (input) => {
    expect(refused(input)).toEqual(expect.any(String));
  });
});

describe("formatPhone", () => {
  it("formate un numéro marocain", () => {
    expect(formatPhone("212612345678")).toBe("+212 6 12 34 56 78");
  });
  it("préfixe un numéro étranger par +", () => {
    expect(formatPhone("33612345678")).toBe("+33612345678");
  });
});

describe("whatsappUrl", () => {
  it("construit le lien sans message", () => {
    expect(whatsappUrl("212612345678")).toBe("https://wa.me/212612345678");
  });
  it("encode le message (accents, espaces, &, guillemets)", () => {
    expect(whatsappUrl("212612345678", "Bonjour, prix de « Éponge x10 » & co ?")).toBe(
      "https://wa.me/212612345678?text=Bonjour%2C%20prix%20de%20%C2%AB%20%C3%89ponge%20x10%20%C2%BB%20%26%20co%20%3F",
    );
  });
});
