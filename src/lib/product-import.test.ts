import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { mapHeader, validateImportRows } from "./product-import";

const categories = [
  { id: "c-peinture", name: "Peinture", slug: "peinture" },
  { id: "c-entretien", name: "Produits d'entretien", slug: "produits-d-entretien" },
];
const existing = [{ id: "p-1", name: "Éponge x10", reference: "EP-10" }];

function run(csv: string) {
  const [header, ...rows] = parseCsv(csv);
  const mapping = mapHeader(header!.cells);
  return { mapping, rows: validateImportRows(rows, mapping.columns, categories, existing) };
}

describe("mapHeader", () => {
  it("reconnaît les colonnes sans tenir compte des accents ni des majuscules", () => {
    const m = mapHeader(["NOM", "Catégorie", "Référence", "Mis en avant", "statut", "Marque", "Description"]);
    expect(m.columns).toEqual({ name: 0, category: 1, reference: 2, featured: 3, status: 4, brand: 5, description: 6 });
    expect(m.missing).toEqual([]);
  });
  it("signale les colonnes obligatoires manquantes", () => {
    expect(mapHeader(["Nom", "Marque"]).missing).toEqual(["category"]);
  });
  it("met à part les colonnes de prix (jamais importées) et les colonnes inconnues", () => {
    const m = mapHeader(["Nom", "Catégorie", "Prix", "Stock"]);
    expect(m.priceColumns).toEqual(["Prix"]);
    expect(m.ignored).toEqual(["Stock"]);
  });
  it("signale une colonne en double", () => {
    expect(mapHeader(["Nom", "Catégorie", "Nom du produit"]).duplicated).toEqual(["Nom du produit"]);
  });
});

describe("validateImportRows", () => {
  it("ligne complète « Publié » → création EN BROUILLON (photo obligatoire pour publier)", () => {
    const { rows } = run("Nom;Catégorie;Statut;Mis en avant\nSeau 10 L;peinture;Publié;oui");
    expect(rows[0]).toEqual({
      line: 2,
      action: "create",
      data: { name: "Seau 10 L", categoryId: "c-peinture", categoryName: "Peinture", status: "DRAFT", isFeatured: true },
      publishDeferred: true,
    });
  });
  it("mise à jour vers « Publié » : refusée sans photo, permise avec photo ou si déjà publié", () => {
    const csv = "Nom;Catégorie;Référence;Statut\n;;EP-10;Publié";
    const [header, ...records] = parseCsv(csv);
    const m = mapHeader(header!.cells);
    const withState = (status: "DRAFT" | "PUBLISHED", hasPhoto: boolean) =>
      validateImportRows(records, m.columns, categories, [{ ...existing[0]!, status, hasPhoto }])[0];
    expect(withState("DRAFT", false)).toMatchObject({ action: "update", publishDeferred: true, data: { reference: "EP-10" } });
    expect(withState("DRAFT", false)).not.toHaveProperty("data.status");
    expect(withState("DRAFT", true)).toMatchObject({ action: "update", data: { status: "PUBLISHED" } });
    expect(withState("PUBLISHED", false)).toMatchObject({ action: "update", data: { status: "PUBLISHED" } });
  });
  it("catégorie reconnue par son nom, sans accents ni majuscules", () => {
    const { rows } = run("Nom;Catégorie\nJavel;PRODUITS D'ENTRETIEN");
    expect(rows[0]).toMatchObject({ action: "create", data: { categoryId: "c-entretien" } });
  });
  it("référence existante (majuscules ignorées) → mise à jour ; cellules vides = inchangées", () => {
    const { rows } = run("Nom;Catégorie;Référence;Marque\n;;ep-10;Spontex");
    expect(rows[0]).toEqual({ line: 2, action: "update", productId: "p-1", data: { reference: "ep-10", brand: "Spontex" } });
  });
  it("création : nom et catégorie obligatoires", () => {
    const { rows } = run("Nom;Catégorie;Marque\n;;Spontex");
    expect(rows[0]).toMatchObject({ action: "error", errors: ["Nom manquant.", "Catégorie manquante."] });
  });
  it("catégorie inconnue, statut inconnu, mis en avant invalide", () => {
    const { rows } = run("Nom;Catégorie;Statut;Mis en avant\nSeau;Jardin;En stock;peut-être");
    expect(rows[0]!.action).toBe("error");
    if (rows[0]!.action !== "error") return;
    expect(rows[0]!.errors).toHaveLength(3);
    expect(rows[0]!.errors[0]).toContain("« Jardin » introuvable");
  });
  it("référence en double dans le fichier → erreur sur la 2e ligne", () => {
    const { rows } = run("Nom;Catégorie;Référence\nA1;Peinture;R-1\nA2;Peinture;r-1");
    expect(rows[0]!.action).toBe("create");
    expect(rows[1]).toMatchObject({ action: "error", errors: ["Référence « r-1 » déjà utilisée ligne 2 du fichier."] });
  });
  it("longueurs maximales", () => {
    const { rows } = run(`Nom;Catégorie;Description\n${"x".repeat(121)};Peinture;${"d".repeat(5001)}`);
    expect(rows[0]).toMatchObject({ action: "error" });
    if (rows[0]!.action === "error") expect(rows[0]!.errors).toHaveLength(2);
  });
  it("la colonne prix n'est jamais lue", () => {
    const { rows } = run("Nom;Catégorie;Prix\nSeau;Peinture;49,90");
    expect(rows[0]).toEqual({ line: 2, action: "create", data: { name: "Seau", categoryId: "c-peinture", categoryName: "Peinture" } });
  });
});
