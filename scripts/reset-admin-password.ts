// Commande de SECOURS : mot de passe administrateur oublié.
//
//   npm run admin:reset-password
//
// À lancer sur le serveur (accès au terminal = preuve d'être le propriétaire du site).
// Demande l'email du compte puis le nouveau mot de passe (saisie masquée, deux fois).
// Effets : nouveau mot de passe, compte réactivé, TOUS les appareils déconnectés,
// blocage « trop de tentatives » levé pour cet email.
// Rien n'est accessible depuis le site web : pas de lien « mot de passe oublié » exploitable par un tiers.
import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { passwordChangeSchema } from "@/lib/account-validation";
import { prisma } from "@/lib/prisma";
import { resetAdminPassword } from "@/server/auth/account";

/** Sortie qu'on peut rendre muette : la saisie du mot de passe ne s'affiche pas. */
class MutableStdout extends Writable {
  muted = false;
  _write(chunk: Buffer, _encoding: BufferEncoding, done: () => void) {
    if (!this.muted) process.stdout.write(chunk);
    done();
  }
}

async function main() {
  if (!process.stdin.isTTY) throw new Error("Commande interactive : lancez-la dans un terminal.");
  const output = new MutableStdout();
  const rl = createInterface({ input: process.stdin, output, terminal: true });

  const askHidden = async (question: string) => {
    process.stdout.write(question);
    output.muted = true;
    const answer = await rl.question("");
    output.muted = false;
    process.stdout.write("\n");
    return answer;
  };

  try {
    const admins = await prisma.adminUser.findMany({ select: { email: true, isActive: true }, orderBy: { createdAt: "asc" } });
    if (admins.length === 0) throw new Error("Aucun compte administrateur : lancez d'abord « npm run db:seed ».");
    console.log("Comptes administrateur :");
    for (const a of admins) console.log(`  - ${a.email}${a.isActive ? "" : " (désactivé)"}`);

    const email = (await rl.question("\nEmail du compte : ")).trim().toLowerCase();
    if (!admins.some((a) => a.email === email)) throw new Error(`Aucun compte avec l'email « ${email} ».`);

    const newPassword = await askHidden("Nouveau mot de passe (12 caractères minimum) : ");
    const confirmPassword = await askHidden("Confirmez le nouveau mot de passe : ");
    // Pas de mot de passe actuel ici (oublié) : valeur neutre pour réutiliser les mêmes règles que l'admin.
    const parsed = passwordChangeSchema.safeParse({ currentPassword: "-", newPassword, confirmPassword });
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Mot de passe refusé.");

    await resetAdminPassword(email, parsed.data.newPassword);
    console.log(`\n✔ Mot de passe de ${email} réinitialisé. Tous les appareils ont été déconnectés.`);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`\n✖ ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
