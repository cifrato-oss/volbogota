import { siteConfig } from "@/config/site";

const formatter = new Intl.NumberFormat(siteConfig.locale);

/** Formats a number with Colombian thousands separators (e.g. 16200 → "16.200"). */
export function formatNumero(value: number): string {
  return formatter.format(value);
}
