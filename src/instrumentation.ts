// Exécuté une fois au démarrage du serveur Next.js (npm run dev ou npm start).
// Journalise l'état de la clé OpenAI (jamais la clé elle-même) pour repérer tout de suite une clé
// absente, mal recopiée ou lue depuis un autre fichier que prévu — avant le premier clic « Générer ».
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.AI_ENABLED?.trim().toLowerCase() !== "true") return;
  const { describeKeyStatus, getApiKeyStatus } = await import("./server/ai/key-status");
  const status = await getApiKeyStatus();
  const line = describeKeyStatus(status);
  if (status.check.ok && !status.source?.shadowed.length && !status.publicLeaks.length) console.info(line);
  else console.warn(line);
}
