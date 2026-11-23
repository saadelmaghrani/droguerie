// Diagnostic technique de la clé OpenAI pour le JOURNAL DU SERVEUR (démarrage) : format, provenance
// (quel fichier .env ou variable système), conflits. Jamais affiché dans l'admin (langage commerçant).
// Côté SERVEUR uniquement. Ne renvoie JAMAIS la clé : seulement l'indice « sk-…abcd ».
import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { envFilesByPriority, inspectApiKey, KEY_ISSUE_MESSAGES, locateKeySource, type KeyCheck, type KeySource } from "./key-check";

export type ApiKeyStatus = {
  check: KeyCheck;
  source: KeySource | null;
  /** Variables NEXT_PUBLIC_* qui contiennent une clé OpenAI : elles seraient envoyées au navigateur. */
  publicLeaks: string[];
  environment: "development" | "production";
};

async function readEnvFiles(names: string[]): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  await Promise.all(
    names.map(async (name) => {
      try {
        // turbopackIgnore : fichiers lus à l'exécution, pas à inclure dans le build.
        files[name] = await readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), name), "utf8");
      } catch {
        // Fichier absent (normal) ou illisible : ignoré.
      }
    }),
  );
  return files;
}

export async function getApiKeyStatus(): Promise<ApiKeyStatus> {
  const value = process.env.OPENAI_API_KEY;
  const check = inspectApiKey(value);
  const files = !check.ok && check.issue === "missing" ? {} : await readEnvFiles(envFilesByPriority(process.env.NODE_ENV));
  return {
    check,
    source: locateKeySource(value, files, process.env.NODE_ENV),
    publicLeaks: Object.keys(process.env).filter((k) => k.startsWith("NEXT_PUBLIC_") && /^\s*["']?sk-/.test(process.env[k] ?? "")),
    environment: process.env.NODE_ENV === "production" ? "production" : "development",
  };
}

/** Une ligne pour le journal du serveur (aucun secret). */
export function describeKeyStatus(status: ApiKeyStatus): string {
  const where = status.source ? (status.source.file ? `lue depuis ${status.source.file}` : "lue depuis une variable du système (shell, Docker…)") : "";
  const parts = [
    status.check.ok ? `format valide (${status.check.hint}), ${where}` : `${KEY_ISSUE_MESSAGES[status.check.issue]}${where ? ` (${where})` : ""}`,
  ];
  if (status.source?.shadowed.length) parts.push(`valeur différente ignorée dans : ${status.source.shadowed.join(", ")}`);
  if (status.publicLeaks.length) parts.push(`DANGER : clé exposée au navigateur via ${status.publicLeaks.join(", ")}`);
  return `[IA] Clé OpenAI : ${parts.join(" · ")}`;
}
