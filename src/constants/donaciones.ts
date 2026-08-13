import type { CategoriaDonacion, EstadoNecesidad, Semaforo } from "@/types/donaciones";

/** Display order for the donation categories. */
export const CATEGORIAS_DONACION: readonly CategoriaDonacion[] = [
  "Alimentos",
  "Elementos de aseo",
  "Elementos de cocina",
  "Elementos para el hogar",
  "Materiales de construcción",
] as const;

/** Badge color for each need state (mirrors the server's mapping). */
export const SEMAFORO_POR_ESTADO: Record<EstadoNecesidad, Semaforo> = {
  SE_NECESITA: "ROJO",
  SUFICIENTE: "VERDE",
  NO_APLICA: "GRIS",
};
