import { z } from "zod";

import { categoriaDonacionSchema } from "./donaciones.schema";

/**
 * Contract for registering a donation intent — the "Quiero donar" checkout.
 *
 * A donor browses a center's needs by category, ticks the items they can bring
 * (the selection is kept across categories on the client), and submits the lot.
 */

export const solicitudDonacionItemSchema = z.object({
  elementoId: z.string().min(1, "El elemento es obligatorio."),
  categoria: categoriaDonacionSchema,
  elemento: z.string().min(1, "El nombre del elemento es obligatorio."),
});
export type SolicitudDonacionItem = z.infer<typeof solicitudDonacionItemSchema>;

export const crearSolicitudDonacionSchema = z.object({
  centroId: z.string().min(1, "El centro de acopio es obligatorio."),
  items: z.array(solicitudDonacionItemSchema).min(1, "Selecciona al menos un elemento para donar."),
});
export type CrearSolicitudDonacionInput = z.infer<typeof crearSolicitudDonacionSchema>;

/** What the endpoint answers with once the intent is registered. */
export interface SolicitudDonacionConfirmacion {
  codigo: string;
  centroId: string;
  totalItems: number;
  recibidoEn: string;
}
