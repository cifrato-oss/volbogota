import { z } from "zod";

/**
 * Client-side mirror of the API's `crearReservaSchema`, tuned for form inputs:
 * `edad` stays a string here (that's what `<input>` yields) and is converted to
 * a number when the payload is built. The server remains the source of truth —
 * this only sharpens the UX so obvious mistakes never leave the browser.
 *
 * EPS and the emergency contact are required here even though the API keeps them
 * optional: the volunteer sign-up must collect them, but the spreadsheet-sync
 * path that shares the server schema has no such columns, so the requirement
 * lives on the form rather than the wire. Their length caps (60 / 40 / 80) match
 * the API's so a value that passes here is never rejected there.
 */

const CELULAR_REGEX = /^3\d{9}$/;

const nombreField = z
  .string()
  .trim()
  .min(2, "Debe tener al menos 2 caracteres.")
  .max(60, "Debe tener máximo 60 caracteres.");

/** The volunteer's own mobile: the strict Colombian `3XXXXXXXXX` rule. */
const celularField = z
  .string()
  .trim()
  .min(1, "El celular es obligatorio.")
  .refine(
    (value) => CELULAR_REGEX.test(value.replace(/\D/g, "")),
    "Debe tener 10 dígitos y empezar por 3.",
  );

/**
 * The emergency phone: required, but deliberately not the volunteer's strict
 * mobile rule — it is often a landline or a relative abroad. Capped at 40 to
 * match the API's `contactoEmergencia`.
 */
const contactoEmergenciaField = z
  .string()
  .trim()
  .min(1, "El celular del contacto es obligatorio.")
  .max(40, "Debe tener máximo 40 caracteres.")
  .refine((value) => value.replace(/\D/g, "").length >= 7, "Ingresa un número de contacto válido.");

export const reservaFormSchema = z.object({
  nombre: nombreField,
  apellido: nombreField,
  celular: celularField,
  edad: z
    .string()
    .trim()
    .min(1, "La edad es obligatoria.")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed >= 18 && parsed <= 110;
    }, "Debes tener entre 18 y 110 años."),
  eps: z
    .string()
    .trim()
    .min(2, "La EPS es obligatoria.")
    .max(80, "Debe tener máximo 80 caracteres."),
  nombreEmergencia: nombreField,
  contactoEmergencia: contactoEmergenciaField,
  autorizoDatos: z
    .boolean()
    .refine((value) => value === true, "Debes autorizar el tratamiento de datos personales."),
});

export type ReservaFormValues = z.infer<typeof reservaFormSchema>;
