// Stockage des fichiers images. Aujourd'hui : disque local (dossier UPLOAD_DIR).
// L'interface Storage permettra de passer à un stockage objet (S3, Hetzner Object Storage)
// sans modifier le reste du code.
import "server-only";

import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export interface Storage {
  write(file: string, data: Buffer): Promise<void>;
  read(file: string): Promise<Buffer | null>;
  /** Supprime tous les fichiers dont le nom commence par `${key}-` (toutes les tailles). */
  removeVariants(key: string, suffixes: string[]): Promise<void>;
}

// /*turbopackIgnore: true*/ : dossier choisi à l'exécution (UPLOAD_DIR). Sans ce marquage, Turbopack
// inclurait tout le projet dans le build serveur (avertissement « Dynamic filesystem access »).
const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads"));

/**
 * Chemin absolu d'un fichier, en refusant toute sortie du dossier de stockage
 * (ex. « ../../.env »). Les clés sont générées par le serveur, mais on se protège quand même.
 */
function resolveSafe(file: string): string {
  const absolute = path.resolve(ROOT, file);
  if (absolute !== ROOT && !absolute.startsWith(ROOT + path.sep)) {
    throw new Error(`Chemin de fichier refusé : ${file}`);
  }
  return absolute;
}

export const localStorage: Storage = {
  async write(file, data) {
    const absolute = resolveSafe(file);
    await mkdir(/*turbopackIgnore: true*/ path.dirname(absolute), { recursive: true });
    await writeFile(/*turbopackIgnore: true*/ absolute, data, { mode: 0o644 });
  },

  async read(file) {
    try {
      const absolute = resolveSafe(file);
      if (!(await stat(/*turbopackIgnore: true*/ absolute)).isFile()) return null;
      return await readFile(/*turbopackIgnore: true*/ absolute);
    } catch {
      return null;
    }
  },

  async removeVariants(key, suffixes) {
    await Promise.all(suffixes.map((suffix) => rm(/*turbopackIgnore: true*/ resolveSafe(`${key}-${suffix}.webp`), { force: true })));
  },
};
