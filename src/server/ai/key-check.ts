// Diagnostic de la clé OPENAI_API_KEY — logique pure (testée par key-check.test.ts).
// Ne renvoie JAMAIS la clé : seulement un indice « sk-…abcd » (4 derniers caractères, comme le tableau
// de bord OpenAI) pour reconnaître QUELLE clé le serveur utilise.

export type KeyIssue =
  | "missing" // absente ou vide
  | "placeholder" // texte d'exemple (« change-moi », « sk-xxx », « <votre clé> »…)
  | "quoted" // guillemet en trop (copier-coller « "sk-… » sans guillemet fermant, etc.)
  | "whitespace" // espace ou retour à la ligne au milieu (clé collée en deux morceaux)
  | "invalid_chars" // caractère non ASCII (tiret long, espace insécable…)
  | "bad_prefix" // ne commence pas par « sk- »
  | "too_short"; // clé tronquée

export type KeyCheck = { ok: true; hint: string } | { ok: false; issue: KeyIssue; hint: string | null };

export const KEY_ISSUE_MESSAGES: Record<KeyIssue, string> = {
  missing: "OPENAI_API_KEY est absente ou vide.",
  placeholder: "OPENAI_API_KEY contient encore un texte d'exemple, pas une vraie clé.",
  quoted: "OPENAI_API_KEY contient un guillemet en trop : écrivez la clé sans guillemets (OPENAI_API_KEY=sk-…).",
  whitespace: "OPENAI_API_KEY contient un espace ou un retour à la ligne : la clé a été collée en plusieurs morceaux.",
  invalid_chars: "OPENAI_API_KEY contient un caractère spécial (tiret long, espace insécable…) : recopiez-la depuis platform.openai.com.",
  bad_prefix: "OPENAI_API_KEY ne commence pas par « sk- » : ce n'est pas une clé API OpenAI.",
  too_short: "OPENAI_API_KEY est trop courte : la clé a probablement été coupée lors du copier-coller.",
};

const MIN_LENGTH = 40;
// Ancré au DÉBUT de la clé : une vraie clé (aléatoire) ne doit jamais être prise pour un exemple.
const PLACEHOLDER = /^(?:sk-)?(?:x{3,}|change|votre|your|exemple|example|remplacer|replace|todo|cle|key)|\.\.\.|…|[<>]/i;

/** « sk-…abcd » : assez pour reconnaître la clé, inutilisable pour s'en servir. */
export function keyHint(key: string): string {
  return key.length > 8 ? `sk-…${key.slice(-4)}` : "sk-…";
}

export function inspectApiKey(raw: string | undefined | null): KeyCheck {
  const key = (raw ?? "").trim();
  if (!key) return { ok: false, issue: "missing", hint: null };
  const hint = keyHint(key);
  if (/["'`]/.test(key)) return { ok: false, issue: "quoted", hint };
  if (/\s/.test(key)) return { ok: false, issue: "whitespace", hint };
  if (PLACEHOLDER.test(key)) return { ok: false, issue: "placeholder", hint };
  if (!/^[\x21-\x7e]+$/.test(key)) return { ok: false, issue: "invalid_chars", hint };
  if (!key.startsWith("sk-")) return { ok: false, issue: "bad_prefix", hint };
  if (key.length < MIN_LENGTH) return { ok: false, issue: "too_short", hint };
  return { ok: true, hint };
}

/**
 * Valeur d'une variable dans le contenu d'un fichier .env (même règles simples que dotenv :
 * « export » facultatif, guillemets assortis retirés, commentaire « # » retiré hors guillemets).
 * La DERNIÈRE définition l'emporte. undefined si la variable n'y est pas.
 */
export function readEnvValue(content: string, name: string): string | undefined {
  let value: string | undefined;
  const line = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=(.*)$`);
  for (const raw of content.split(/\r?\n/)) {
    const match = line.exec(raw);
    if (!match) continue;
    let v = match[1].trim();
    const quote = v[0];
    if ((quote === '"' || quote === "'" || quote === "`") && v.length > 1 && v.indexOf(quote, 1) > 0) {
      v = v.slice(1, v.indexOf(quote, 1));
    } else {
      v = v.replace(/\s+#.*$/, "").trim();
    }
    value = v;
  }
  return value;
}

/** Fichiers lus par Next.js, du plus prioritaire au moins prioritaire (après les variables du système). */
export function envFilesByPriority(nodeEnv: string | undefined): string[] {
  const mode = nodeEnv === "production" ? "production" : nodeEnv === "test" ? "test" : "development";
  return [`.env.${mode}.local`, ...(mode === "test" ? [] : [".env.local"]), `.env.${mode}`, ".env"];
}

export type KeySource = {
  /** Fichier d'où vient la clé utilisée, ou null = variable du système (shell, Docker, hébergeur). */
  file: string | null;
  /** Fichiers qui définissent AUSSI la clé avec une autre valeur (ignorée) : source de confusion. */
  shadowed: string[];
};

/**
 * D'où vient la clé lue par le serveur ? Compare la valeur utilisée avec celle de chaque fichier .env,
 * dans l'ordre de priorité de Next.js. `files` : nom → contenu (fichiers absents omis).
 */
export function locateKeySource(runtimeValue: string | undefined, files: Record<string, string>, nodeEnv: string | undefined): KeySource | null {
  const runtime = runtimeValue?.trim();
  if (!runtime) return null;
  const defined = envFilesByPriority(nodeEnv)
    .filter((f) => f in files)
    .map((file) => ({ file, value: readEnvValue(files[file], "OPENAI_API_KEY")?.trim() }))
    .filter((d): d is { file: string; value: string } => Boolean(d.value));
  const source = defined.find((d) => d.value === runtime);
  return {
    file: source?.file ?? null,
    shadowed: defined.filter((d) => d.value !== runtime).map((d) => d.file),
  };
}
