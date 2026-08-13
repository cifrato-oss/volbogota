/**
 * Wall-clock helpers for Bogotá.
 *
 * Check-in times are what a coordinator reads off a phone at the gate, so they
 * are stored as local `HH:MM` rather than as instants. The server may well run
 * in UTC, so the zone is pinned here instead of trusting the host's clock
 * settings.
 */

const ZONA = "America/Bogota";

export function horaActualBogota(fecha: Date = new Date()): string {
  return (
    new Intl.DateTimeFormat("es-CO", {
      timeZone: ZONA,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .format(fecha)
      // es-CO can render midnight as "24:00"; the storage format tops out at 23:59.
      .replace(/^24:/, "00:")
  );
}

/** `YYYY-MM-DD` for today in Bogotá, for defaulting operational filters. */
export function fechaActualBogota(fecha: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);

  return partes;
}
