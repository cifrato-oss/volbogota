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
  /** Program window, shown in the header badge. */
  eventLabel: "13 – 16 Agosto 2026",
  nav: [{ label: "Inicio", href: "/" }],
} as const;

export type SiteConfig = typeof siteConfig;
