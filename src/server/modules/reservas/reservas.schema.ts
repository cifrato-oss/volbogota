import { z } from "zod";

import { jornadaSchema } from "@/server/modules/catalogo/catalogo.schema";

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

/** Minimum age to volunteer at a collection point. */
export const EDAD_MINIMA = 18;

/**
 * Booking request.
 *
 * Deliberately short: name, surname, phone, age and consent. Every field here
 * is personal data about someone volunteering during an emergency, so the form
 * asks for what the operation actually needs and nothing else.
 *
 * Consent is `literal(true)` rather than a boolean: the spreadsheet treats
 * "Sin autorización" as blocking, so a `false` is rejected at the edge instead
 * of being stored and filtered later.
 */
export const crearReservaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, "El nombre es obligatorio.")
    .max(60, "El nombre es demasiado largo."),
  apellido: z
    .string()
    .trim()
    .min(2, "El apellido es obligatorio.")
    .max(60, "El apellido es demasiado largo."),
  celular: celularSchema,
  edad: z.coerce
    .number({ error: "La edad debe ser un número." })
    .int("La edad debe ser un número entero.")
    .min(EDAD_MINIMA, `Debes tener al menos ${EDAD_MINIMA} años para inscribirte.`)
    .max(110, "Revisa la edad."),
  turnoId: z.string().min(1, "Debes seleccionar un turno."),
  autorizoDatos: z.literal(true, {
    error: "Debes autorizar el tratamiento de datos personales.",
  }),
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
  apellido: z.string(),
  celular: z.string(),
  edad: z.number().int(),
  autorizoDatos: z.boolean(),
  estado: estadoReservaSchema,
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
    direccion: string | null;
    horarioOficial: string | null;
  };
};
