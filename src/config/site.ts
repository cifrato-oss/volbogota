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
  nav: [
    { label: "Inicio", href: "/" },
    { label: "Donar", href: "/donar" },
    { label: "Ser voluntario", href: "/voluntarios" },
    { label: "Donar sangre", href: "/sangre" },
  ],
} as const;

export type SiteConfig = typeof siteConfig;
