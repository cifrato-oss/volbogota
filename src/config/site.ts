/**
 * Static, non-secret metadata about the product. Safe to import anywhere.
 */
export const siteConfig = {
  name: "VolBogotá",
  description: "Plataforma de VolBogotá.",
  locale: "es-CO",
  nav: [{ label: "Inicio", href: "/" }],
} as const;

export type SiteConfig = typeof siteConfig;
