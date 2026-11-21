// Télécharge le modèle de détourage ISNet (≈ 170 Mo, licence Apache-2.0) utilisé pour la
// « photo fond studio ». À lancer une fois par machine : npm run ai:model
// Destination : $MODELS_DIR (défaut ./storage/models), hors Git. Empreinte MD5 vérifiée.
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx";
const MD5 = "fc16ebd8b0c10d971d3513d564d01e29";
const dir = path.resolve(process.env.MODELS_DIR || path.join(process.cwd(), "storage", "models"));
const target = path.join(dir, "isnet-general-use.onnx");

const md5 = (file) => createHash("md5").update(readFileSync(file)).digest("hex");

if (existsSync(target) && md5(target) === MD5) {
  console.log(`✔ Modèle déjà présent : ${target}`);
  process.exit(0);
}

mkdirSync(dir, { recursive: true });
const partial = `${target}.part`;
console.log(`Téléchargement du modèle de détourage (≈ 170 Mo)…\n  ${URL}`);
const response = await fetch(URL);
if (!response.ok || !response.body) {
  console.error(`✘ Téléchargement impossible (HTTP ${response.status}).`);
  process.exit(1);
}
await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
const sum = md5(partial);
if (sum !== MD5) {
  rmSync(partial, { force: true });
  console.error(`✘ Fichier corrompu (MD5 ${sum}, attendu ${MD5}). Relancez la commande.`);
  process.exit(1);
}
renameSync(partial, target);
console.log(`✔ Modèle installé : ${target}`);
