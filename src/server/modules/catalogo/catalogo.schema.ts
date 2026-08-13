import { z } from "zod";

/**
 * Domain vocabulary for the collection-centre programme.
 *
 * The spreadsheet is the administrative source: coordinators edit centres and
 * capacity there and an import syncs it into Firestore. These schemas describe
 * what lives in Firestore once imported, not the raw spreadsheet columns.
 */

/** Shifts run three times a day at every centre. */
export const JORNADAS = ["AM", "PM", "NOCHE"] as const;
export const jornadaSchema = z.enum(JORNADAS, {
  error: () => `La jornada debe ser una de: ${JORNADAS.join(", ")}.`,
});
export type Jornada = z.infer<typeof jornadaSchema>;

/** Fixed schedule per shift, taken from the spreadsheet. */
export const HORARIOS: Record<Jornada, { inicio: string; fin: string; etiqueta: string }> = {
  AM: { inicio: "08:00", fin: "14:00", etiqueta: "8:00 a.m. - 2:00 p.m." },
  PM: { inicio: "13:00", fin: "17:00", etiqueta: "1:00 p.m. - 5:00 p.m." },
  NOCHE: { inicio: "19:00", fin: "22:00", etiqueta: "7:00 p.m. - 10:00 p.m." },
};

/** Label used in the spreadsheet and in the UI. */
export const ETIQUETA_JORNADA: Record<Jornada, string> = {
  AM: "AM",
  PM: "PM",
  NOCHE: "Noche",
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
