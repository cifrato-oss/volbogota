import { siteConfig } from "@/config/site";

/**
 * Formats an ISO date string (`YYYY-MM-DD`) for display in Colombian Spanish.
 *
 * The string is parsed as a *local* date (not UTC) so it never shifts to the
 * previous day in negative-offset timezones — a real risk with `new Date(iso)`.
 */
export function formatFecha(
  iso: string,
  options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" },
): string {
  const [year, month, day] = iso.split("-").map(Number);

  if (!year || !month || !day) return iso;

  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(siteConfig.locale, options).format(date);
}
