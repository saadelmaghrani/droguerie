// Import CSV des produits : reconnaissance des colonnes et validation ligne par ligne.
// Logique pure (aucun accès base) : la base est lue par src/server/products/import.ts,
// qui passe ici les catégories et références existantes. Testé par product-import.test.ts.
import type { CsvRecord } from "./csv";
import type { ProductStatusValue } from "./product-status";

export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export type ImportField = "name" | "category" | "description" | "reference" | "brand" | "status" | "featured";

/** Noms de colonnes acceptés (comparés sans accents, majuscules, espaces ni tirets). */
const HEADER_ALIASES: Record<ImportField, string[]> = {
  name: ["nom", "nomduproduit", "produit", "designation", "name"],
  category: ["categorie", "category"],
  description: ["description", "descriptif"],
  reference: ["reference", "ref", "refarticle", "codearticle"],
  brand: ["marque", "brand"],
  status: ["statut", "status", "etat"],
  featured: ["misenavant", "enavant", "vedette", "featured"],
};
const PRICE_HEADERS = ["prix", "price", "tarif", "pu", "prixunitaire", "prixht", "prixttc"];

/** En-têtes du modèle téléchargeable, dans l'ordre. */
export const TEMPLATE_HEADERS = ["Nom", "Catégorie", "Description", "Référence", "Marque", "Statut", "Mis en avant"];

export function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export type HeaderMapping = {
  columns: Partial<Record<ImportField, number>>;
  /** Colonnes non reconnues (ignorées). */
  ignored: string[];
  /** Colonnes de prix détectées (jamais importées). */
  priceColumns: string[];
  missing: ImportField[];
  duplicated: string[];
};

export function mapHeader(header: string[]): HeaderMapping {
  const columns: HeaderMapping["columns"] = {};
  const ignored: string[] = [];
  const priceColumns: string[] = [];
  const duplicated: string[] = [];
  header.forEach((raw, index) => {
    const key = normalizeKey(raw);
    if (!key) return;
    const field = (Object.keys(HEADER_ALIASES) as ImportField[]).find((f) => HEADER_ALIASES[f].includes(key));
    if (field === undefined) (PRICE_HEADERS.includes(key) ? priceColumns : ignored).push(raw.trim());
    else if (columns[field] !== undefined) duplicated.push(raw.trim());
    else columns[field] = index;
  });
  const missing = (["name", "category"] as const).filter((f) => columns[f] === undefined);
  return { columns, ignored, priceColumns, missing, duplicated };
}

const STATUS_VALUES: Record<string, ProductStatusValue> = {
  brouillon: "DRAFT",
  draft: "DRAFT",
  publie: "PUBLISHED",
  published: "PUBLISHED",
  enligne: "PUBLISHED",
  visible: "PUBLISHED",
  masque: "HIDDEN",
  cache: "HIDDEN",
  hidden: "HIDDEN",
};
const TRUE_VALUES = ["oui", "o", "yes", "y", "1", "x", "vrai", "true"];
const FALSE_VALUES = ["non", "n", "no", "0", "faux", "false"];

export type ImportCategory = { id: string; name: string; slug: string };
export type ExistingProduct = {
  id: string;
  name: string;
  reference: string;
  status?: ProductStatusValue;
  /** A déjà une photo principale (sinon il ne peut pas être publié). */
  hasPhoto?: boolean;
};

/** Valeurs à écrire. undefined = cellule vide → valeur inchangée (mise à jour) ou valeur par défaut (création). */
export type ImportRowData = {
  name?: string;
  categoryId?: string;
  categoryName?: string;
  description?: string;
  reference?: string;
  brand?: string;
  status?: ProductStatusValue;
  isFeatured?: boolean;
};

/** publishDeferred : « Publié » demandé, mais pas de photo → importé / laissé non publié. */
export type ImportRow =
  | { line: number; action: "create"; data: ImportRowData; publishDeferred?: boolean }
  | { line: number; action: "update"; productId: string; data: ImportRowData; publishDeferred?: boolean }
  | { line: number; action: "error"; errors: string[]; name: string };

export function validateImportRows(
  records: CsvRecord[],
  columns: HeaderMapping["columns"],
  categories: ImportCategory[],
  existing: ExistingProduct[],
): ImportRow[] {
  const categoryByKey = new Map<string, ImportCategory>();
  for (const c of categories) {
    categoryByKey.set(normalizeKey(c.name), c);
    categoryByKey.set(normalizeKey(c.slug), c);
  }
  const productByRef = new Map(existing.map((p) => [p.reference.toLowerCase(), p]));
  const seenRefs = new Map<string, number>(); // référence (minuscules) → 1re ligne qui l'utilise

  return records.map(({ line, cells }): ImportRow => {
    const cell = (field: ImportField) => {
      const index = columns[field];
      return index === undefined ? "" : (cells[index] ?? "").trim();
    };
    const errors: string[] = [];
    const data: ImportRowData = {};

    const reference = cell("reference");
    let existingProduct: ExistingProduct | undefined;
    if (reference) {
      if (reference.length > 50) errors.push("Référence : 50 caractères maximum.");
      const key = reference.toLowerCase();
      const firstLine = seenRefs.get(key);
      if (firstLine !== undefined) errors.push(`Référence « ${reference} » déjà utilisée ligne ${firstLine} du fichier.`);
      else seenRefs.set(key, line);
      existingProduct = productByRef.get(key);
      data.reference = reference;
    }
    const isUpdate = existingProduct !== undefined;

    const name = cell("name");
    if (name) {
      if (name.length < 2) errors.push("Nom : 2 caractères minimum.");
      else if (name.length > 120) errors.push(`Nom : 120 caractères maximum (actuellement ${name.length}).`);
      data.name = name;
    } else if (!isUpdate) errors.push("Nom manquant.");

    const categoryValue = cell("category");
    if (categoryValue) {
      const category = categoryByKey.get(normalizeKey(categoryValue));
      if (category) {
        data.categoryId = category.id;
        data.categoryName = category.name;
      } else errors.push(`Catégorie « ${categoryValue} » introuvable. Créez-la d'abord dans Catégories.`);
    } else if (!isUpdate) errors.push("Catégorie manquante.");

    const description = cell("description");
    if (description) {
      if (description.length > 5000) errors.push(`Description : 5000 caractères maximum (actuellement ${description.length}).`);
      data.description = description;
    }
    const brand = cell("brand");
    if (brand) {
      if (brand.length > 60) errors.push("Marque : 60 caractères maximum.");
      data.brand = brand;
    }
    const status = cell("status");
    if (status) {
      const value = STATUS_VALUES[normalizeKey(status)];
      if (value) data.status = value;
      else errors.push(`Statut « ${status} » inconnu. Valeurs possibles : Brouillon, Publié, Masqué.`);
    }
    const featured = normalizeKey(cell("featured"));
    if (featured) {
      if (TRUE_VALUES.includes(featured)) data.isFeatured = true;
      else if (FALSE_VALUES.includes(featured)) data.isFeatured = false;
      else errors.push(`Mis en avant « ${cell("featured")} » : répondez Oui ou Non.`);
    }

    if (errors.length > 0) return { line, action: "error", errors, name: name || existingProduct?.name || "" };

    // Photo obligatoire pour publier (les photos ne passent pas par le CSV) :
    //  - nouveau produit « Publié » → importé en brouillon ;
    //  - produit existant non publié et sans photo → statut inchangé.
    // Un produit DÉJÀ publié le reste (image par défaut sur le site tant qu'il n'a pas de photo).
    if (data.status === "PUBLISHED") {
      if (!existingProduct) {
        return { line, action: "create", data: { ...data, status: "DRAFT" }, publishDeferred: true };
      }
      if (existingProduct.status !== "PUBLISHED" && !existingProduct.hasPhoto) {
        const rest = { ...data };
        delete rest.status;
        return { line, action: "update", productId: existingProduct.id, data: rest, publishDeferred: true };
      }
    }
    return existingProduct
      ? { line, action: "update", productId: existingProduct.id, data }
      : { line, action: "create", data };
  });
}
