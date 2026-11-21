// Fuseau horaire du Maroc calculé par Node.js (données ICU à jour, Ramadan compris).
//
// Pourquoi pas PostgreSQL (« AT TIME ZONE 'Africa/Casablanca' ») ? L'image Docker postgres:18-alpine
// embarque des données de fuseau incomplètes pour le Maroc : elle applique UTC+0 au lieu de UTC+1
// (constaté le 21/11/2026). Les statistiques calculent donc les heures locales ici, puis envoient à
// PostgreSQL des instants UTC et des décalages explicites. Logique pure, testée par timezone.test.ts.

export const MOROCCO_TZ = "Africa/Casablanca";

/** Décalage par rapport à UTC, en minutes, à un instant donné (ex. +60 au Maroc hors Ramadan). */
export function utcOffsetMinutes(instant: Date, timeZone = MOROCCO_TZ): number {
  const label = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(instant)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = label.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!match) return 0; // « GMT » seul = UTC+0
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "-" ? -minutes : minutes;
}

/** Instant UTC correspondant à minuit (heure locale) du jour AAAA-MM-JJ. */
export function localMidnightUtc(day: string, timeZone = MOROCCO_TZ): Date {
  const naive = Date.parse(`${day}T00:00:00Z`);
  let guess = naive - utcOffsetMinutes(new Date(naive), timeZone) * 60_000;
  // Deuxième passe : le décalage peut changer entre minuit UTC et minuit local.
  guess = naive - utcOffsetMinutes(new Date(guess), timeZone) * 60_000;
  return new Date(guess);
}

export type OffsetSegment = { from: Date; offsetMinutes: number };

/**
 * Découpe [start, end[ en périodes de décalage constant (au Maroc : 0 à 2 changements par an).
 * Recherche jour par jour puis heure par heure autour des changements.
 */
export function offsetSegments(start: Date, end: Date, timeZone = MOROCCO_TZ): OffsetSegment[] {
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;
  const segments: OffsetSegment[] = [{ from: start, offsetMinutes: utcOffsetMinutes(start, timeZone) }];
  let previous = start.getTime();
  for (let t = start.getTime() + DAY; t < end.getTime() + DAY; t += DAY) {
    const at = Math.min(t, end.getTime());
    const offset = utcOffsetMinutes(new Date(at), timeZone);
    if (offset !== segments.at(-1)!.offsetMinutes) {
      // Changement entre previous et at : on cherche l'heure exacte.
      let change = previous;
      for (let h = previous + HOUR; h <= at; h += HOUR) {
        if (utcOffsetMinutes(new Date(h), timeZone) === offset) {
          change = h;
          break;
        }
      }
      segments.push({ from: new Date(change), offsetMinutes: offset });
    }
    previous = at;
  }
  return segments;
}

/** Instant UTC au format accepté par PostgreSQL pour une colonne « timestamp » (sans fuseau). */
export function toSqlTimestamp(instant: Date): string {
  return instant.toISOString().replace("T", " ").replace("Z", "");
}
