import { z } from "zod";

/**
 * Domain vocabulary for the collection-centre programme.
 *
 * The spreadsheet is the administrative source: coordinators edit centres and
 * capacity there and an import syncs it into Firestore. These schemas describe
 * what lives in Firestore once imported, not the raw spreadsheet columns.
 */

/** Morning and afternoon everywhere; evening only where the point opens at night. */
export const JORNADAS = ["AM", "PM", "NOCHE"] as const;
export const jornadaSchema = z.enum(JORNADAS, {
  error: () => `La jornada debe ser una de: ${JORNADAS.join(", ")}.`,
});
export type Jornada = z.infer<typeof jornadaSchema>;

export const horarioSchema = z.object({
  inicio: z.string(),
  fin: z.string(),
  etiqueta: z.string(),
});
export type Horario = z.infer<typeof horarioSchema>;

/** Default schedule per shift, used when a `Turnos` row does not state its own. */
export const HORARIOS: Record<Jornada, Horario> = {
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
  /**
   * Partial on purpose: a point that never opens at night has no `NOCHE` key,
   * and the centres already stored carry only `AM`/`PM`. Requiring every shift
   * would fail them all against the schema and empty the catalogue.
   */
  cuposPorJornada: z.partialRecord(jornadaSchema, z.number().int().nonnegative()),
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
  horario: horarioSchema,
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
 * A row of the `Turnos` sheet, once its columns have been understood.
 *
 * `centroId` is the slug of the point's display name, which is how the sheet
 * refers to it — the same derivation `Reservas` uses. Renaming a point in the
 * sheet therefore produces a different id and orphans its shifts; the fix is an
 * explicit id column on both sheets, deliberately deferred.
 */
export type TurnoDeHoja = {
  centroId: string;
  fecha: string;
  jornada: Jornada;
  /** Null when the row leaves the column empty: `HORARIOS` decides. */
  horario: Horario | null;
  cuposTotales: number;
};

/**
 * The programme's shifts: one per centre × date × slot, overridden by `Turnos`.
 *
 * `Centros` states each point's nominal capacity per shift, and the product of
 * centres, dates and slots is what that implies. But nominal capacity cannot say
 * that El Campín takes 300 on Thursday and 150 on Friday, or that a point opens
 * at night on one day only — so a row of the `Turnos` sheet wins over the
 * product for the shift it names, and creates that shift when the product does
 * not reach it at all, which is how a date outside the calendar gets opened.
 *
 * Capacity 0 still means the point does not open in that shift, whichever side
 * states it: the sheet's own instructions are explicit that it must not be
 * bookable. Dropping a row from `Turnos` is therefore not a deletion — the shift
 * reverts to the nominal capacity `Centros` gives it.
 */
export function construirTurnos(
  centros: Centro[],
  fechas: string[],
  filas: TurnoDeHoja[] = [],
): Turno[] {
  const porId = new Map(centros.map((centro) => [centro.id, centro]));
  const turnos = new Map<string, Turno>();

  for (const centro of centros) {
    for (const fecha of fechas) {
      for (const jornada of JORNADAS) {
        const turno = armarTurno(
          centro,
          fecha,
          jornada,
          centro.cuposPorJornada[jornada] ?? 0,
          null,
        );
        turnos.set(turno.id, turno);
      }
    }
  }

  for (const fila of filas) {
    const centro = porId.get(fila.centroId);
    // A row naming a point that is not in the catalogue is reported back to the
    // sheet by the sync; here it simply has no centre to hang off.
    if (!centro) continue;

    const turno = armarTurno(centro, fila.fecha, fila.jornada, fila.cuposTotales, fila.horario);
    turnos.set(turno.id, turno);
  }

  return [...turnos.values()];
}

function armarTurno(
  centro: Centro,
  fecha: string,
  jornada: Jornada,
  cuposTotales: number,
  horario: Horario | null,
): Turno {
  return {
    id: buildTurnoId(centro.id, fecha, jornada),
    centroId: centro.id,
    centroNombre: centro.nombre,
    fecha,
    diaSemana: diaSemanaDe(fecha),
    jornada,
    horario: horario ?? HORARIOS[jornada],
    horarioOficialCentro: centro.horarioOficial,
    centroActivo: centro.activo,
    cuposTotales,
    reservados: 0,
    estado: centro.activo && cuposTotales > 0 ? "ABIERTO" : "CERRADO",
    coordinador: centro.coordinador,
  };
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
