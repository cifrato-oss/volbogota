import { formatFecha } from "@/lib/format-fecha";

/**
 * Formats a list of ISO dates as a human range, e.g.
 * `["2026-08-13", …, "2026-08-16"]` → "13 al 16 de agosto de 2026".
 *
 * Assumes the input is chronologically ordered (as the API returns it).
 */
export function formatRangoFechas(fechas: string[]): string {
  if (fechas.length === 0) return "";

  const first = fechas[0]!;
  const last = fechas[fechas.length - 1]!;
  const full: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" };

  if (first === last) return formatFecha(first, full);

  return `${formatFecha(first, { day: "numeric" })} al ${formatFecha(last, full)}`;
}
