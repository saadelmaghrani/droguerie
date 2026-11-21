// Numéros de téléphone WhatsApp : saisie souple → format international stocké en base.
//
// Formats acceptés (exemples pour le même numéro) :
//   06 12 34 56 78   ·  0612345678   ·  +212 6 12 34 56 78  ·  +212 06 12 34 56 78
//   00212 6 12 34 56 78  ·  212612345678  ·  (+212) 612-345-678
// Résultat stocké : 212612345678 (chiffres uniquement, sans « + » : format utilisé par wa.me).
//
// Logique pure, sans dépendance : utilisée côté serveur (validation) ET côté navigateur (aperçu).

export type PhoneParseResult = { ok: true; value: string } | { ok: false; error: string };

const MOROCCO_CODE = "212";
const EXAMPLE = "Exemples : 06 12 34 56 78 ou +212 6 12 34 56 78.";

export function normalizePhone(input: string): PhoneParseResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "Saisissez un numéro." };

  if (/[^\d\s().+\-/]/.test(raw)) {
    return { ok: false, error: "Le numéro ne peut contenir que des chiffres, des espaces et + - . ( )." };
  }
  const plusCount = (raw.match(/\+/g) ?? []).length;
  if (plusCount > 1 || (plusCount === 1 && !raw.replace(/^[\s(]+/, "").startsWith("+"))) {
    return { ok: false, error: "Le signe + doit être placé au début du numéro." };
  }

  const digits = raw.replace(/\D/g, "");
  let international: string;

  if (plusCount === 1) {
    international = digits; // +212…, +33…
  } else if (digits.startsWith("00")) {
    international = digits.slice(2); // 00212…
  } else if (digits.startsWith("0")) {
    // Format national marocain : 0 + 9 chiffres.
    if (digits.length !== 10) {
      return { ok: false, error: `Un numéro marocain commençant par 0 doit contenir 10 chiffres. ${EXAMPLE}` };
    }
    international = MOROCCO_CODE + digits.slice(1);
  } else if (digits.startsWith(MOROCCO_CODE)) {
    international = digits; // 212… sans « + »
  } else {
    return { ok: false, error: `Format non reconnu. ${EXAMPLE}` };
  }

  // Erreur fréquente : « +212 06… » → on retire le 0 placé après l'indicatif.
  if (international.startsWith(`${MOROCCO_CODE}0`)) {
    international = MOROCCO_CODE + international.slice(4);
  }

  if (international.startsWith(MOROCCO_CODE)) {
    // Maroc : 9 chiffres après +212, commençant par 5 (fixe), 6 ou 7 (mobile), 8 (VoIP).
    if (!/^212[5-8]\d{8}$/.test(international)) {
      return { ok: false, error: `Numéro marocain invalide : 9 chiffres attendus après +212. ${EXAMPLE}` };
    }
  } else if (!/^[1-9]\d{7,14}$/.test(international)) {
    // Autre pays : format international E.164 (8 à 15 chiffres).
    return { ok: false, error: "Numéro international invalide (8 à 15 chiffres après le +)." };
  }

  return { ok: true, value: international };
}

/** Affichage lisible : 212612345678 → « +212 6 12 34 56 78 ». */
export function formatPhone(stored: string): string {
  const morocco = stored.match(/^212(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/);
  if (morocco) return `+212 ${morocco.slice(1).join(" ")}`;
  return `+${stored}`;
}

/** Lien WhatsApp « click to chat », avec message prérempli facultatif. */
export function whatsappUrl(stored: string, message?: string): string {
  const base = `https://wa.me/${stored}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
