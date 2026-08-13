import { z } from "zod";

/**
 * Client-side mirror of the API's `crearReservaSchema`, tuned for form inputs:
 * `edad` stays a string here (that's what `<input>` yields) and is converted to
 * a number when the payload is built. The server remains the source of truth —
 * this only sharpens the UX so obvious mistakes never leave the browser.
 */

const CELULAR_REGEX = /^3\d{9}$/;

const nombreField = z
  .string()
  .trim()
  .min(2, "Debe tener al menos 2 caracteres.")
  .max(60, "Debe tener máximo 60 caracteres.");

export const reservaFormSchema = z.object({
  nombre: nombreField,
  apellido: nombreField,
  celular: z
    .string()
    .trim()
    .min(1, "El celular es obligatorio.")
    .refine(
      (value) => CELULAR_REGEX.test(value.replace(/\D/g, "")),
      "Debe tener 10 dígitos y empezar por 3.",
    ),
  edad: z
    .string()
    .trim()
    .min(1, "La edad es obligatoria.")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed >= 18 && parsed <= 110;
    }, "Debes tener entre 18 y 110 años."),
  autorizoDatos: z
    .boolean()
    .refine((value) => value === true, "Debes autorizar el tratamiento de datos personales."),
});

export type ReservaFormValues = z.infer<typeof reservaFormSchema>;
