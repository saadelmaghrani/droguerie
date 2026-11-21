// Libellé d'une période de graphique (jour ou mois), en français. Logique pure : serveur + navigateur.
export function formatBucket(bucket: string, unit: "day" | "month", long = false): string {
  const date = new Date(`${bucket}T12:00:00Z`);
  return unit === "month"
    ? new Intl.DateTimeFormat("fr-FR", { month: long ? "long" : "short", year: long ? "numeric" : "2-digit", timeZone: "UTC" }).format(date)
    : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", ...(long ? { weekday: "short", year: "numeric" } : {}), timeZone: "UTC" }).format(date);
}
