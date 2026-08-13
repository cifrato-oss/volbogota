import { z } from "zod";

import { actividadSchema, jornadaSchema } from "@/server/modules/catalogo/catalogo.schema";

export const ESTADOS_RESERVA = [
  "RESERVADO",
  "CONFIRMADO",
  "ASISTIO",
  "NO_ASISTIO",
  "CANCELADO",
] as const;
export const estadoReservaSchema = z.enum(ESTADOS_RESERVA);
export type EstadoReserva = z.infer<typeof estadoReservaSchema>;

/** Colombian mobile: ten digits starting with 3. */
const celularSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(z.string().regex(/^3\d{9}$/, "El celular debe tener 10 dígitos y empezar por 3."));

/**
 * Booking request.
 *
 * The consent flags are `literal(true)` rather than booleans: the spreadsheet
 * treats "Sin autorización" and "Verificar edad" as blocking, so a `false`
 * must be rejected at the edge instead of stored and filtered later.
 */
export const crearReservaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, "El nombre completo es obligatorio.")
    .max(120, "El nombre es demasiado largo."),
  celular: celularSchema,
  turnoId: z.string().min(1, "Debes seleccionar un turno."),
  actividad: actividadSchema,
  autorizoDatos: z.literal(true, {
    error: "Debes autorizar el tratamiento de datos personales.",
  }),
  mayorDeEdad: z.literal(true, {
    error: "Debes ser mayor de edad para inscribirte.",
  }),
  contactoEmergencia: z
    .object({
      nombre: z.string().trim().min(3, "El nombre del contacto es obligatorio."),
      celular: celularSchema,
    })
    .optional(),
  eps: z.string().trim().max(80).optional(),
  notas: z.string().trim().max(500).optional(),
});
export type CrearReservaInput = z.infer<typeof crearReservaSchema>;

export const reservaSchema = z.object({
  id: z.string(),
  codigo: z.string(),
  turnoId: z.string(),
  centroId: z.string(),
  centroNombre: z.string(),
  fecha: z.string(),
  jornada: jornadaSchema,
  nombre: z.string(),
  celular: z.string(),
  actividad: actividadSchema,
  autorizoDatos: z.boolean(),
  mayorDeEdad: z.boolean(),
  estado: estadoReservaSchema,
  contactoEmergencia: z.object({ nombre: z.string(), celular: z.string() }).nullable(),
  eps: z.string().nullable(),
  notas: z.string().nullable(),
  creadoEn: z.string(),
  checkIn: z.string().nullable(),
  checkOut: z.string().nullable(),
  horas: z.number().nullable(),
});
export type Reserva = z.infer<typeof reservaSchema>;

/**
 * What the volunteer gets back. Personal data they just typed is not echoed,
 * and nothing about other volunteers leaks through the shift counters.
 */
export type ConfirmacionReserva = {
  codigo: string;
  estado: EstadoReserva;
  nombre: string;
  turno: {
    id: string;
    centroNombre: string;
    fecha: string;
    jornada: string;
    horario: string;
  };
  actividad: string;
};
