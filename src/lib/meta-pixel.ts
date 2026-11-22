// Meta (Facebook) Pixel : règles pures (serveur + navigateur), testées par meta-pixel.test.ts.

/**
 * Identifiant de Pixel : uniquement des chiffres (15 à 16 en pratique, toléré de 10 à 20).
 * Accepte un copier-coller avec espaces. Vide → null (pas de Pixel).
 */
export function parsePixelId(input: string | null | undefined): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = (input ?? "").replace(/\s+/g, "");
  if (!value) return { ok: true, value: null };
  if (!/^\d{10,20}$/.test(value)) {
    return { ok: false, error: "Identifiant invalide : uniquement des chiffres (ex. 123456789012345), à copier depuis le Gestionnaire d'événements Meta." };
  }
  return { ok: true, value };
}

/** Pixel à charger sur le site public : seulement s'il est activé ET valide, sinon null. */
export function activePixelId(enabled: boolean | null | undefined, id: string | null | undefined): string | null {
  if (!enabled) return null;
  const parsed = parsePixelId(id);
  return parsed.ok ? parsed.value : null;
}
