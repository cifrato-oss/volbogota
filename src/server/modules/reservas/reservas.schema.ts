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

/**
 * Whether the volunteer turned up, as a coordinator marked it at the door.
 *
 * Its own vocabulary rather than a boolean: `NO_ASISTIO` is a thing someone
 * observed and wrote down, and `false` reads the same as never having been
 * asked. Absent — `null` — is the third case and the common one.
 */
export const ASISTENCIAS = ["ASISTIO", "NO_ASISTIO"] as const;
export const asistenciaSchema = z.enum(ASISTENCIAS);
export type Asistencia = z.infer<typeof asistenciaSchema>;

/** Colombian mobile: ten digits starting with 3. */
const celularSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ""))
  .pipe(z.string().regex(/^3\d{9}$/, "El celular debe tener 10 dígitos y empezar por 3."));

/** Minimum age to volunteer at a collection point. */
export const EDAD_MINIMA = 18;

/**
 * Emergency phone and health provider.
 *
 * Optional on purpose: the columns exist in the sheet and the form is about to
 * ask for them, but a booking that already works must not start failing because
 * a client has not shipped the fields yet. An empty string is stored as null so
 * "not asked" and "left blank" read the same downstream.
 *
 * The emergency number is not held to the volunteer's own `3XXXXXXXXX` rule: it
 * is often a landline or a relative abroad, and rejecting those would block the
 * booking over the one field meant to help in an emergency.
 */
const opcionalSchema = (max: number, mensaje: string) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((valor) => valor?.trim() || null)
    .pipe(z.string().max(max, mensaje).nullable());

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
  /** Sheet column R, `Contacto emergencia` — who to call. */
  nombreEmergencia: opcionalSchema(60, "El nombre del contacto es demasiado largo."),
  /** Sheet column S, `Cel. emergencia` — the number to call. */
  contactoEmergencia: opcionalSchema(40, "El contacto de emergencia es demasiado largo."),
  /** Sheet column T, `EPS`. */
  eps: opcionalSchema(80, "El nombre de la EPS es demasiado largo."),
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
  // Nullable and defaulted: bookings taken before these columns existed carry
  // neither, and failing them against the schema would empty the listing.
  nombreEmergencia: z.string().nullable().default(null),
  contactoEmergencia: z.string().nullable().default(null),
  eps: z.string().nullable().default(null),
  estado: estadoReservaSchema,
  /**
   * What the sheet's `Asistencia` column says. Independent of `estado`: a
   * booking can be `CONFIRMADO` and still have no attendance recorded, and null
   * means "not marked yet" rather than "did not show up".
   */
  asistencia: asistenciaSchema.nullable().default(null),
  creadoEn: z.string(),
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
