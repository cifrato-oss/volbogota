import { z } from "zod";

import { fechaSchema, jornadaSchema } from "@/server/modules/catalogo/catalogo.schema";

import { estadoReservaSchema, type EstadoReserva } from "./reservas.schema";

/**
 * Which state changes are allowed.
 *
 * The spreadsheet describes the flow as
 * `Reservado → Confirmado → Asistió / No asistió`, with `Cancelado` reachable
 * from anywhere it still makes sense. Encoding it means a coordinator cannot
 * mark someone as attended after they cancelled, or walk a finished shift back
 * to "reserved" by tapping the wrong chip.
 */
export const TRANSICIONES: Record<EstadoReserva, readonly EstadoReserva[]> = {
  RESERVADO: ["CONFIRMADO", "ASISTIO", "NO_ASISTIO", "CANCELADO"],
  // Someone can confirm by WhatsApp and cancel later; both still happen.
  CONFIRMADO: ["ASISTIO", "NO_ASISTIO", "CANCELADO"],
  // Attendance is a fact, not a plan. Correcting a mistyped one is the only
  // reason to move away from it.
  ASISTIO: ["NO_ASISTIO"],
  NO_ASISTIO: ["ASISTIO"],
  CANCELADO: [],
};

export function puedeTransicionar(desde: EstadoReserva, hacia: EstadoReserva): boolean {
  return TRANSICIONES[desde].includes(hacia);
}

export const cambiarEstadoSchema = z.object({
  estado: estadoReservaSchema,
});
export type CambiarEstadoInput = z.infer<typeof cambiarEstadoSchema>;

/** `HH:MM` in Bogotá local time, as read off the phone at the door. */
const horaSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora debe ir en formato HH:MM (24 horas).");

export const registrarHoraSchema = z.object({
  /** Omitted means "right now", which is the common case at the gate. */
  hora: horaSchema.optional(),
});
export type RegistrarHoraInput = z.infer<typeof registrarHoraSchema>;

export const listarReservasSchema = z.object({
  turno: z.string().min(1).optional(),
  centro: z.string().min(1).optional(),
  fecha: fechaSchema.optional(),
  jornada: jornadaSchema.optional(),
  estado: estadoReservaSchema.optional(),
  /** Free text over name, surname and phone. */
  q: z.string().trim().min(2).max(60).optional(),
  limite: z.coerce.number().int().min(1).max(500).default(100),
  /** `creadoEn` of the last item of the previous page. */
  desde: z.string().optional(),
});
export type ListarReservasInput = z.infer<typeof listarReservasSchema>;
