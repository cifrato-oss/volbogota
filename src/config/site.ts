/**
 * Static, non-secret metadata about the product. Safe to import anywhere.
 */
export const siteConfig = {
  name: "Centros de Acopio Bogotá",
  shortName: "Centros de Acopio",
  /** Intended public handle/domain, e.g. centrosdeacopiobogota.gov.co */
  domain: "centrosdeacopiobogota",
  description:
    "Aquí encontrarás toda la información sobre los puntos de acopio oficiales de la Alcaldía Mayor de Bogotá y la Cruz Roja.",
  locale: "es-CO",
  /** Program window, shown in the landing badge. */
  eventLabel: "13 – 16 Agosto 2026",
  /** Longer form for the header badge. */
  eventLabelLong: "Jornadas del 13 al 16 de Agosto 2026",
  nav: [{ label: "Inicio", href: "/" }],
} as const;

export type SiteConfig = typeof siteConfig;
