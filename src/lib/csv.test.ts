import { describe, expect, it } from "vitest";
import { decodeCsvBytes, detectDelimiter, parseCsv, toCsv } from "./csv";

describe("decodeCsvBytes", () => {
  it("lit l'UTF-8 et retire le BOM", () => {
    const bytes = new TextEncoder().encode("﻿nom;catégorie");
    expect(decodeCsvBytes(bytes)).toBe("nom;catégorie");
  });
  it("lit le Windows-1252 d'Excel (accents)", () => {
    // « Éponge ; catégorie » en Windows-1252 : É = 0xC9, é = 0xE9
    const bytes = new Uint8Array([0xc9, 0x70, 0x6f, 0x6e, 0x67, 0x65, 0x3b, 0x63, 0x61, 0x74, 0xe9]);
    expect(decodeCsvBytes(bytes)).toBe("Éponge;caté");
  });
});

describe("detectDelimiter", () => {
  it("point-virgule (Excel français)", () => expect(detectDelimiter("nom;categorie;marque\na;b;c")).toBe(";"));
  it("virgule", () => expect(detectDelimiter("nom,categorie\na,b")).toBe(","));
  it("tabulation", () => expect(detectDelimiter("nom\tcategorie\na\tb")).toBe("\t"));
  it("ignore les séparateurs entre guillemets", () => expect(detectDelimiter('"a,b,c";d;e')).toBe(";"));
});

describe("parseCsv", () => {
  it("découpe les lignes et garde les numéros de ligne", () => {
    expect(parseCsv("nom;cat\r\nA;B\r\nC;D\r\n")).toEqual([
      { line: 1, cells: ["nom", "cat"] },
      { line: 2, cells: ["A", "B"] },
      { line: 3, cells: ["C", "D"] },
    ]);
  });
  it("gère guillemets, guillemets doublés et retours à la ligne dans un champ", () => {
    const records = parseCsv('nom;desc\n"Seau 10 L";"Ligne 1\nLigne ""2"""\nSuivant;x');
    expect(records[1]).toEqual({ line: 2, cells: ["Seau 10 L", 'Ligne 1\nLigne "2"'] });
    expect(records[2]).toEqual({ line: 4, cells: ["Suivant", "x"] }); // ligne 4 : le champ précédent tenait sur 2 lignes
  });
  it("ignore les lignes vides (y compris « ;; » d'Excel)", () => {
    expect(parseCsv("a;b\n\n;;\nc;d").map((r) => r.line)).toEqual([1, 4]);
  });
  it("garde les cellules vides", () => {
    expect(parseCsv("a;;c")[0]!.cells).toEqual(["a", "", "c"]);
  });
  it("lit un fichier sans retour à la ligne final", () => {
    expect(parseCsv("a;b\nc;d")).toHaveLength(2);
  });
});

describe("toCsv", () => {
  it("met entre guillemets les valeurs qui contiennent un séparateur ou un guillemet", () => {
    expect(toCsv([["a;b", 'dit "x"', "simple"]])).toBe('"a;b";"dit ""x""";simple\r\n');
  });
  it("aller-retour avec parseCsv", () => {
    const rows = [["nom", "description"], ["Seau", "Ligne 1\nLigne 2; suite"]];
    expect(parseCsv(toCsv(rows)).map((r) => r.cells)).toEqual(rows);
  });
});
