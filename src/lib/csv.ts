// Lecture / écriture de fichiers CSV (logique pure : serveur + navigateur).
//
// Excel en français enregistre souvent :
//   - avec des POINTS-VIRGULES (la virgule sert aux nombres décimaux) ;
//   - en « Windows-1252 » (ancien encodage) au lieu d'UTF-8 : les accents seraient illisibles
//     si on lisait le fichier en UTF-8.
// On gère donc les deux séparateurs et les deux encodages automatiquement.

export type CsvRecord = {
  /** Numéro de la ligne dans le fichier (1 = en-tête), comme dans Excel. */
  line: number;
  cells: string[];
};

/** Octets → texte : UTF-8 (avec ou sans BOM), sinon Windows-1252 (Excel « CSV (séparateur : point-virgule) »). */
export function decodeCsvBytes(bytes: Uint8Array): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }
  return text.replace(/^﻿/, ""); // BOM : marque invisible ajoutée par Excel en UTF-8
}

/** Séparateur le plus fréquent sur la 1re ligne (hors guillemets) : « ; », « , » ou tabulation. */
export function detectDelimiter(text: string): string {
  const counts = new Map<string, number>([[";", 0], [",", 0], ["\t", 0]]);
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && counts.has(char)) counts.set(char, counts.get(char)! + 1);
  }
  let best = ";";
  for (const [delimiter, count] of counts) if (count > counts.get(best)!) best = delimiter;
  return best;
}

/**
 * Découpe un CSV (norme RFC 4180) : champs entre guillemets, guillemets doublés (""),
 * retours à la ligne DANS un champ (description sur plusieurs lignes).
 * Les lignes entièrement vides sont ignorées.
 */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  const endRecord = () => {
    cells.push(cell);
    if (cells.some((c) => c.trim() !== "")) records.push({ line: recordLine, cells });
    cells = [];
    cell = "";
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else {
        if (char === "\n") line++;
        cell += char;
      }
    } else if (char === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (char === delimiter) {
      cells.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      endRecord();
      line++;
      recordLine = line;
    } else {
      cell += char;
    }
  }
  if (cell !== "" || cells.length > 0) endRecord();
  return records;
}

/** Tableau → CSV « ; » compatible Excel français. */
export function toCsv(rows: string[][], delimiter = ";"): string {
  const escape = (value: string) => (/[";\n\r,\t]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return rows.map((row) => row.map(escape).join(delimiter)).join("\r\n") + "\r\n";
}
