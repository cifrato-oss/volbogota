import { z } from "zod";

/**
 * Domain vocabulary for the collection-centre programme.
 *
 * The spreadsheet is the administrative source: coordinators edit centres and
 * capacity there and an import syncs it into Firestore. These schemas describe
 * what lives in Firestore once imported, not the raw spreadsheet columns.
 */

/** Shifts run twice a day at every centre: morning and afternoon. */
export const JORNADAS = ["AM", "PM"] as const;
export const jornadaSchema = z.enum(JORNADAS, {
  error: () => `La jornada debe ser una de: ${JORNADAS.join(", ")}.`,
});
export type Jornada = z.infer<typeof jornadaSchema>;

/** Fixed schedule per shift, taken from the spreadsheet. */
export const HORARIOS: Record<Jornada, { inicio: string; fin: string; etiqueta: string }> = {
  AM: { inicio: "08:00", fin: "14:00", etiqueta: "8:00 a.m. - 2:00 p.m." },
  PM: { inicio: "13:00", fin: "17:00", etiqueta: "1:00 p.m. - 5:00 p.m." },
};

/** Label used in the spreadsheet and in the UI. */
export const ETIQUETA_JORNADA: Record<Jornada, string> = {
  AM: "AM",
  PM: "PM",
};

export const ACTIVIDADES = ["Empaque", "Clasificación", "Carga y descarga"] as const;
export const actividadSchema = z.enum(ACTIVIDADES, {
  error: () => `La actividad debe ser una de: ${ACTIVIDADES.join(", ")}.`,
});
export type Actividad = z.infer<typeof actividadSchema>;

/** `YYYY-MM-DD`. Stored as a string so a date never shifts across time zones. */
export const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe ser YYYY-MM-DD.");

export const ESTADOS_TURNO = ["ABIERTO", "CERRADO"] as const;
export const estadoTurnoSchema = z.enum(ESTADOS_TURNO);
export type EstadoTurno = z.infer<typeof estadoTurnoSchema>;

export const coordinadorSchema = z.object({
  nombre: z.string(),
  celular: z.string().nullable(),
});

export const centroSchema = z.object({
  id: z.string(),
  nombre: z.string(),
  direccion: z.string().nullable(),
  localidad: z.string().nullable(),
  linkMaps: z.string().nullable(),
  /**
   * When the point is actually open, as published by the city — e.g.
   * "8:00 a.m. - 9:00 p.m." or "24 horas". This is not the same as the shift
   * schedule: several points close before the evening shift's nominal end.
   */
  horarioOficial: z.string().nullable(),
  /**
   * Operational notes straight from the spreadsheet, verbatim. Kept as prose
   * because that is what it is: parsing it into flags would invent structure
   * the source does not have and break the next time someone rewords a cell.
   */
  observaciones: z.string().nullable(),
  actividades: z.array(actividadSchema),
  cuposPorJornada: z.record(jornadaSchema, z.number().int().nonnegative()),
  activo: z.boolean(),
  coordinador: coordinadorSchema.nullable(),
});
export type Centro = z.infer<typeof centroSchema>;

export const turnoSchema = z.object({
  id: z.string(),
  centroId: z.string(),
  centroNombre: z.string(),
  fecha: fechaSchema,
  diaSemana: z.string(),
  jornada: jornadaSchema,
  horario: z.object({
    inicio: z.string(),
    fin: z.string(),
    etiqueta: z.string(),
  }),
  /**
   * The point's published opening hours, copied here so a caller listing shifts
   * does not have to fetch the centre to know when the door is actually open.
   */
  horarioOficialCentro: z.string().nullable(),
  /**
   * Whether the point is still authorised. A point dropped from the spreadsheet
   * keeps its shifts for history — a reservation may reference them — but they
   * must stop being listed and stop counting toward public totals.
   */
  centroActivo: z.boolean(),
  cuposTotales: z.number().int().nonnegative(),
  /**
   * Live counter kept by the booking transaction. Never derived by counting
   * documents at read time: that races under load and costs one read per
   * reservation.
   */
  reservados: z.number().int().nonnegative(),
  estado: estadoTurnoSchema,
  coordinador: coordinadorSchema.nullable(),
});
export type Turno = z.infer<typeof turnoSchema>;

/** What the API exposes for a shift — capacity is presented, not recomputed. */
export type TurnoPublico = Turno & {
  disponibles: number;
  ocupacion: number;
  agotado: boolean;
};

export function toTurnoPublico(turno: Turno): TurnoPublico {
  const disponibles = Math.max(0, turno.cuposTotales - turno.reservados);

  return {
    ...turno,
    disponibles,
    ocupacion: turno.cuposTotales === 0 ? 0 : turno.reservados / turno.cuposTotales,
    agotado: disponibles === 0,
  };
}

/** `vive-claro_2026-08-13_am` — stable, URL-safe, and derivable from its parts. */
export function buildTurnoId(centroId: string, fecha: string, jornada: Jornada): string {
  return `${centroId}_${fecha}_${jornada.toLowerCase()}`;
}

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Pinned to noon UTC so the weekday never rolls across time zones. */
export function diaSemanaDe(fecha: string): string {
  return DIAS_SEMANA[new Date(`${fecha}T12:00:00Z`).getUTCDay()] ?? "";
}

/**
 * One shift per centre × date × slot, mirroring the `Turnos` sheet.
 *
 * Shared by the spreadsheet import and the sync hook so that "capacity 0 means
 * the point does not open in that shift" is decided in exactly one place. The
 * sheet's own instructions are explicit that those shifts must not be bookable.
 */
export function construirTurnos(centros: Centro[], fechas: string[]): Turno[] {
  const turnos: Turno[] = [];

  for (const centro of centros) {
    for (const fecha of fechas) {
      for (const jornada of JORNADAS) {
        const cupos = centro.cuposPorJornada[jornada] ?? 0;

        turnos.push({
          id: buildTurnoId(centro.id, fecha, jornada),
          centroId: centro.id,
          centroNombre: centro.nombre,
          fecha,
          diaSemana: diaSemanaDe(fecha),
          jornada,
          horario: HORARIOS[jornada],
          horarioOficialCentro: centro.horarioOficial,
          centroActivo: centro.activo,
          cuposTotales: cupos,
          reservados: 0,
          estado: centro.activo && cupos > 0 ? "ABIERTO" : "CERRADO",
          coordinador: centro.coordinador,
        });
      }
    }
  }

  return turnos;
}

/** `Vive Claro` → `vive-claro`. Accents are folded so ids stay ASCII. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
