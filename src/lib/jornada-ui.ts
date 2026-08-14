/**
 * Client-side display for shift slots (jornadas). Firestore can hold any value
 * beyond AM/PM (e.g. "MADRUGADA", "TARDE", "NOCHE", "MADRUGADA 2"), so these
 * resolve an emoji, a nicely-cased label, and a sensible order for whatever
 * shows up.
 */

const ETIQUETAS: Record<string, string> = {
  AM: "AM",
  PM: "PM",
  TARDE: "Tarde",
  NOCHE: "Noche",
  MADRUGADA: "Madrugada",
};

/** Rough time-of-day order for the known slots; unknown ones sort after. */
const ORDEN: Record<string, number> = {
  MADRUGADA: 0,
  AM: 1,
  TARDE: 2,
  PM: 3,
  NOCHE: 4,
};

/** Canonical casing for known slots; Title Case for the rest ("MADRUGADA 2"). */
export function etiquetaJornada(jornada: string): string {
  const conocida = ETIQUETAS[jornada.toUpperCase()];
  if (conocida) return conocida;
  return jornada
    .toLowerCase()
    .split(" ")
    .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(" ");
}

/** A time-of-day emoji, inferred from the slot's name. */
export function emojiJornada(jornada: string): string {
  const j = jornada.toLowerCase();
  if (j.includes("madrugada")) return "🌘";
  if (j.includes("noche")) return "🌙";
  if (j === "am" || j.includes("mañan") || j.includes("manan")) return "☀️";
  if (j.includes("tarde")) return "🌤️";
  if (j === "pm") return "🌆";
  return "🕐";
}

/** The slots that actually have capacity, ordered by time of day. */
export function jornadasConCupos(
  cuposPorJornada: Record<string, number>,
): Array<{ jornada: string; cupos: number }> {
  return Object.entries(cuposPorJornada)
    .filter(([, cupos]) => cupos > 0)
    .map(([jornada, cupos]) => ({ jornada, cupos }))
    .sort(
      (a, b) =>
        (ORDEN[a.jornada.toUpperCase()] ?? 99) - (ORDEN[b.jornada.toUpperCase()] ?? 99) ||
        a.jornada.localeCompare(b.jornada, "es"),
    );
}
