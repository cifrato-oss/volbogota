import type { CategoriaDonacion } from "@/types/volbogota";

/** Canonical display order for the five donation categories. */
export const CATEGORIA_DONACION_ORDER: readonly CategoriaDonacion[] = [
  "Alimentos",
  "Elementos de aseo",
  "Elementos de cocina",
  "Elementos para el hogar",
  "Materiales de construcción",
] as const;
