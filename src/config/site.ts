/**
 * Static, non-secret metadata about the product. Safe to import anywhere.
 */
export const siteConfig = {
  name: "Centros de Acopio Bogotá",
  description:
    "Aquí encontrarás toda la información sobre los puntos de acopio oficiales de la Alcaldía Mayor de Bogotá y la Cruz Roja.",
  locale: "es-CO",
  nav: [{ label: "Inicio", href: "/" }],
} as const;

export type SiteConfig = typeof siteConfig;
