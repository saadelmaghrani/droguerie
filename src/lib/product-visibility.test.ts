import { describe, expect, it } from "vitest";
import { pickWhatsappPhone, productVisibilityIssues, productWhatsappMessage } from "./product-visibility";

describe("pickWhatsappPhone", () => {
  const cat = { phone: "212611111111", isActive: true };
  const def = { phone: "212622222222", isActive: true };

  it("utilise le numéro de la catégorie s'il est actif", () => {
    expect(pickWhatsappPhone(cat, def)).toBe("212611111111");
  });
  it("retombe sur le numéro par défaut si celui de la catégorie est inactif", () => {
    expect(pickWhatsappPhone({ ...cat, isActive: false }, def)).toBe("212622222222");
  });
  it("retombe sur le numéro par défaut si la catégorie n'a pas de numéro", () => {
    expect(pickWhatsappPhone(null, def)).toBe("212622222222");
  });
  it("renvoie null si aucun numéro n'est configuré", () => {
    expect(pickWhatsappPhone(null, null)).toBeNull();
  });
});

describe("productWhatsappMessage", () => {
  it("contient le nom du produit", () => {
    expect(productWhatsappMessage("Éponge x10")).toBe(
      "Bonjour, je souhaite connaître le prix et la disponibilité de : Éponge x10",
    );
  });
  it("ajoute la référence si elle existe", () => {
    expect(productWhatsappMessage("Éponge x10", " EP-10 ")).toMatch(/Éponge x10 \(réf\. EP-10\)$/);
  });
  it("ignore une référence vide", () => {
    expect(productWhatsappMessage("Éponge x10", "  ")).not.toContain("réf.");
  });
});

describe("productVisibilityIssues", () => {
  const ok = {
    status: "PUBLISHED" as const,
    categoryName: "Peinture",
    categoryActive: true,
    imageCount: 1,
    hasWhatsapp: true,
    hasDescription: true,
  };

  it("aucun problème pour un produit publié complet", () => {
    expect(productVisibilityIssues(ok)).toEqual([]);
  });
  it("brouillon et masqué sont bloquants", () => {
    expect(productVisibilityIssues({ ...ok, status: "DRAFT" })[0]?.level).toBe("blocking");
    expect(productVisibilityIssues({ ...ok, status: "HIDDEN" })[0]?.level).toBe("blocking");
  });
  it("une catégorie masquée bloque l'affichage", () => {
    const issues = productVisibilityIssues({ ...ok, categoryActive: false });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ level: "blocking" });
    expect(issues[0]!.message).toContain("Peinture");
  });
  it("photo, description et WhatsApp manquants sont des avertissements", () => {
    const issues = productVisibilityIssues({ ...ok, imageCount: 0, hasWhatsapp: false, hasDescription: false });
    expect(issues.map((i) => i.level)).toEqual(["warning", "warning", "warning"]);
  });
});
