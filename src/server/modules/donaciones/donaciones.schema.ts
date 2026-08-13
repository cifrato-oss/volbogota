import { z } from "zod";

import { slugify } from "@/server/modules/catalogo/catalogo.schema";

/**
 * Domain vocabulary for the "Quiero donar" flow.
 *
 * Mirrors `catalogo.schema`: the spreadsheet's `Catálogo` sheet is the
 * authority on which items exist (few, stable, synced by import), and its
 * `Necesidades` sheet is the authority on which of them are needed at each
 * point right now (56 items × 6 points, edited in real time by coordinators).
 */

/** The five categories the programme collects. A closed set, like `ACTIVIDADES`. */
export const CATEGORIAS_DONACION = [
  "Alimentos",
  "Elementos de aseo",
  "Elementos de cocina",
  "Elementos para el hogar",
  "Materiales de construcción",
] as const;
export const categoriaDonacionSchema = z.enum(CATEGORIAS_DONACION, {
  error: () => `La categoría debe ser una de: ${CATEGORIAS_DONACION.join(", ")}.`,
});
export type CategoriaDonacion = z.infer<typeof categoriaDonacionSchema>;

/**
 * The donation semaphore has three states, not two: a point can also have an
 * item that simply does not apply to it (e.g. Palacio de los Deportes collects
 * for Chocó, not every item in the general catalogue).
 */
export const ESTADOS_NECESIDAD = ["SE_NECESITA", "SUFICIENTE", "NO_APLICA"] as const;
export const estadoNecesidadSchema = z.enum(ESTADOS_NECESIDAD, {
  error: () => `El estado debe ser uno de: ${ESTADOS_NECESIDAD.join(", ")}.`,
});
export type EstadoNecesidad = z.infer<typeof estadoNecesidadSchema>;

export const SEMAFOROS = ["ROJO", "VERDE", "GRIS"] as const;
export type Semaforo = (typeof SEMAFOROS)[number];

/** What each need state renders as on the badge. */
export const SEMAFORO_POR_ESTADO: Record<EstadoNecesidad, Semaforo> = {
  SE_NECESITA: "ROJO",
  SUFICIENTE: "VERDE",
  NO_APLICA: "GRIS",
};

/** Default for a centre × item pair the sheet has never set: assume it is needed. */
export const ESTADO_POR_DEFECTO: EstadoNecesidad = "SE_NECESITA";

export const elementoDonacionSchema = z.object({
  id: z.string(),
  categoria: categoriaDonacionSchema,
  /** Display order within its category. */
  orden: z.number().int().nonnegative(),
  nombre: z.string(),
  /** Category-level note, e.g. "Revisa siempre las fechas de vencimiento." */
  mensaje: z.string().nullable(),
});
export type ElementoDonacion = z.infer<typeof elementoDonacionSchema>;

export const necesidadSchema = z.object({
  id: z.string(),
  centroId: z.string(),
  centroNombre: z.string(),
  elementoId: z.string(),
  categoria: categoriaDonacionSchema,
  elemento: z.string(),
  estado: estadoNecesidadSchema,
  /** ISO datetime. `null` when the pair has never been touched by a sync or the admin panel. */
  actualizadoEn: z.string().nullable(),
});
export type Necesidad = z.infer<typeof necesidadSchema>;

/** What the API exposes for a need — the badge colour is presented, not recomputed. */
export type NecesidadPublica = Necesidad & { mensaje: string | null; semaforo: Semaforo };

export function toNecesidadPublica(necesidad: Necesidad, mensaje: string | null): NecesidadPublica {
  return { ...necesidad, mensaje, semaforo: SEMAFORO_POR_ESTADO[necesidad.estado] };
}

/** `Alimentos` + `Arroz blanco` → `alimentos-arroz-blanco`. Stable across re-imports. */
export function buildElementoId(categoria: string, nombre: string): string {
  return `${slugify(categoria)}-${slugify(nombre)}`;
}

/** `cruz-roja` + `alimentos-arroz-blanco` → `cruz-roja_alimentos-arroz-blanco`. */
export function buildNecesidadId(centroId: string, elementoId: string): string {
  return `${centroId}_${elementoId}`;
}
