import { z } from "zod";

import { fechaSchema } from "@/server/modules/catalogo/catalogo.schema";
import { EDAD_MINIMA } from "@/server/modules/reservas/reservas.schema";

/**
 * What the spreadsheet sends when a coordinator edits it.
 *
 * Apps Script reads cells, so everything arrives as text: capacity comes as
 * `"150"` (and `"1,050"` on the totals row), yes/no columns as `"Sí"`, dates as
 * `"13/08/2026"`. These schemas normalise the types; `sheets.mapper` translates
 * the meanings. Columns the sheet carries but the contract does not model are
 * simply absent here — the contract is the authority, not the spreadsheet.
 */

/** Capacity cells arrive as text, sometimes with a thousands separator. */
const cuposSchema = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((valor) => {
    if (typeof valor === "number") return valor;
    if (!valor) return 0;

    const limpio = valor.replace(/[^\d-]/g, "");
    return limpio === "" ? 0 : Number(limpio);
  })
  .pipe(z.number().int().nonnegative("Los cupos no pueden ser negativos."));

const textoOpcional = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((valor) => {
    if (valor === null || valor === undefined) return null;
    const texto = String(valor).trim();
    return texto === "" ? null : texto;
  });

/** A row of the `Centros` sheet. */
export const filaCentroSchema = z.object({
  puntoDeAcopio: z.string().trim().min(1, "El punto de acopio es obligatorio."),
  direccion: textoOpcional,
  localidad: textoOpcional,
  horarioOficial: textoOpcional,
  cuposAm: cuposSchema,
  cuposPm: cuposSchema,
  /** Absent in sheets that never reinstated the evening shift: empty means 0. */
  cuposNoche: cuposSchema,
  /** Comma-separated in the sheet: "Empaque, Clasificación, Carga y descarga". */
  actividades: textoOpcional,
  linkMaps: textoOpcional,
  activo: textoOpcional,
  observaciones: textoOpcional,
});
export type FilaCentro = z.infer<typeof filaCentroSchema>;

/**
 * A row of the `Turnos` sheet.
 *
 * This is the sheet's authority over a single shift: which point, which day,
 * which slot, at what hours and for how many volunteers. `Cupos totales` may
 * hold a formula that looks the figure up in `Centros` or a number typed over
 * it; either way the cell arrives here as its computed value, which is what
 * makes one column carry both the nominal figure and the exception to it.
 */
export const filaTurnoSchema = z.object({
  /** 1-based row number in the sheet, so a rejection can name it. */
  fila: z.number().int().positive(),
  /** The point's display name, exactly as `Centros` writes it. */
  puntoDeAcopio: z.string().trim().min(1, "El punto de acopio es obligatorio."),
  fecha: z.string().trim().min(1, "La fecha es obligatoria."),
  jornada: z.string().trim().min(1, "La jornada es obligatoria."),
  /** Empty falls back to the shift's default schedule. */
  horario: textoOpcional,
  cuposTotales: cuposSchema,
});
export type FilaTurno = z.infer<typeof filaTurnoSchema>;

export const sincronizarTurnosSchema = z.object({
  filas: z.array(filaTurnoSchema).min(1, "No llegó ninguna fila."),
});
export type SincronizarTurnosInput = z.infer<typeof sincronizarTurnosSchema>;

/** Why a `Turnos` row could not be applied, for the coordinator who typed it. */
export type FilaTurnoRechazada = { fila: number; motivo: string };

export const sincronizarCentrosSchema = z.object({
  filas: z.array(filaCentroSchema).min(1, "No llegó ninguna fila."),
  /**
   * The programme's dates, from the `Listas` sheet. Optional: a capacity edit
   * should not have to restate the calendar, so when it is missing the dates
   * already in Firestore are reused.
   */
  fechas: z.array(fechaSchema).optional(),
  /**
   * The `Turnos` board, so one rebuild sees both halves of the truth. Optional:
   * a sheet that does not send it gets the plain centre-driven catalogue.
   */
  turnos: z.array(filaTurnoSchema).optional(),
});
export type SincronizarCentrosInput = z.infer<typeof sincronizarCentrosSchema>;

/**
 * The sheet has no age column, and the contract requires one. Rows written by
 * hand therefore land on the legal minimum: it is the only value that cannot
 * make an ineligible volunteer look eligible.
 */
export const EDAD_POR_DEFECTO = EDAD_MINIMA;

const edadSchema = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((valor) => {
    if (valor === null || valor === undefined || valor === "") return EDAD_POR_DEFECTO;
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : EDAD_POR_DEFECTO;
  });

/** A row of the `Reservas` sheet. */
export const filaReservaSchema = z.object({
  /** 1-based row number in the sheet, so the answer can be written back to it. */
  fila: z.number().int().positive(),
  /** Empty on a row a coordinator just typed; `VB-…` once we have answered. */
  codigo: textoOpcional,
  nombreCompleto: z.string().trim().min(1, "El nombre completo es obligatorio."),
  celular: z.string().trim().min(1, "El celular es obligatorio."),
  edad: edadSchema,
  /** `Punto Usaquén|2026-08-13|AM`. */
  idTurno: textoOpcional,
  // Fallback when ID_Turno is empty — the sheet computes it with a formula that
  // does not fill in until the row is complete.
  puntoDeAcopio: textoOpcional,
  fechaJornada: textoOpcional,
  jornada: textoOpcional,
  autorizoDatos: textoOpcional,
  estado: textoOpcional,
  /** `HH:MM`. */
  checkIn: textoOpcional,
  checkOut: textoOpcional,
});
export type FilaReserva = z.infer<typeof filaReservaSchema>;

export const sincronizarReservasSchema = z.object({
  filas: z.array(filaReservaSchema).min(1, "No llegó ninguna fila."),
});
export type SincronizarReservasInput = z.infer<typeof sincronizarReservasSchema>;

/** What Apps Script writes back into the row it sent. */
export type ResultadoFila = {
  fila: number;
  /** `OK` or the reason the row could not be applied, for the Validación column. */
  validacion: string;
  codigo: string | null;
  estado: string | null;
  /** True when this row created a reservation rather than updating one. */
  creada: boolean;
};
