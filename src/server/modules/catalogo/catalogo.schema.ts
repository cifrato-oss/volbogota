import { z } from "zod";

/**
 * Domain vocabulary for the collection-centre programme.
 *
 * The spreadsheet is the administrative source: coordinators edit centres and
 * capacity there and an import syncs it into Firestore. These schemas describe
 * what lives in Firestore once imported, not the raw spreadsheet columns.
 */

/**
 * A shift's slot within the day.
 *
 * Open on purpose. The `Turnos` sheet is the authority on which slots actually
 * run, and the programme invents them as the operation demands — `MADRUGADA 1`,
 * `MADRUGADA 2`. A closed enum would reject the row rather than open the shift,
 * so the value is normalised to one spelling and otherwise taken as written.
 */
export type Jornada = string;

/** `  madrugada  1 ` → `MADRUGADA 1`: one spelling per slot, whoever typed it. */
export function normalizarJornada(valor: string): Jornada {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
}

export const jornadaSchema = z
  .string()
  .trim()
  .min(1, "La jornada es obligatoria.")
  .transform(normalizarJornada);

export const horarioSchema = z.object({
  inicio: z.string(),
  fin: z.string(),
  etiqueta: z.string(),
});
export type Horario = z.infer<typeof horarioSchema>;

/**
 * Fallback schedule for the slots the programme runs by default.
 *
 * Only reached when a `Turnos` row leaves its `Horario` cell empty — the sheet's
 * own column wins whenever it is filled. A slot that is not here and states no
 * schedule is rejected: inventing hours for `MADRUGADA 2` would publish a time
 * nobody authorised.
 */
export const HORARIOS: Record<string, Horario> = {
  AM: { inicio: "08:00", fin: "13:00", etiqueta: "8:00 a.m. - 1:00 p.m." },
  TARDE: { inicio: "13:00", fin: "18:00", etiqueta: "1:00 p.m. - 6:00 p.m." },
  PM: { inicio: "18:00", fin: "21:00", etiqueta: "6:00 p.m. - 9:00 p.m." },
  MADRUGADA: { inicio: "00:00", fin: "06:00", etiqueta: "12:00 a.m. - 6:00 a.m." },
  /** Kept for boards still written against the older three-slot day. */
  NOCHE: { inicio: "19:00", fin: "22:00", etiqueta: "7:00 p.m. - 10:00 p.m." },
};

/** Display label: the canonical casing for known slots, verbatim for the rest. */
const ETIQUETAS: Record<string, string> = {
  AM: "AM",
  PM: "PM",
  TARDE: "Tarde",
  NOCHE: "Noche",
  MADRUGADA: "Madrugada",
};

export function etiquetaJornada(jornada: Jornada): string {
  return ETIQUETAS[jornada] ?? jornada;
}

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
   * Nominal capacity per slot, as `Centros` states it. Sparse on purpose: a
   * point that never opens at night carries no `NOCHE` key, and the slots
   * themselves are open-ended, so the keys are whatever that sheet's columns
   * name. Informative only — the `Turnos` board is what creates shifts.
   */
  cuposPorJornada: z.record(z.string(), z.number().int().nonnegative()),
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
  // Slugged, not just lower-cased: a slot like `MADRUGADA 1` would otherwise
  // put a space in a document id.
  return `${centroId}_${fecha}_${slugify(jornada)}`;
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
 * The programme's shifts, one per row of the `Turnos` board.
 *
 * That board is the sole authority on which shifts exist. `Centros` states a
 * nominal capacity per slot, but deriving shifts from the product of centres,
 * dates and slots is what coupled the two sheets: editing an address rebuilt
 * every shift, and the per-day figures the board had authorised were flattened
 * back to nominal. A row states its own point, day, slot, hours and capacity,
 * so the two syncs no longer have to agree about anything.
 *
 * Capacity 0 still means the point does not open in that shift: the sheet's own
 * instructions are explicit that it must not be bookable.
 */
export function construirTurnos(centros: Centro[], filas: TurnoDeHoja[]): Turno[] {
  const porId = new Map(centros.map((centro) => [centro.id, centro]));
  const turnos = new Map<string, Turno>();

  for (const fila of filas) {
    const centro = porId.get(fila.centroId);
    // A row naming a point that is not in the catalogue is reported back to the
    // sheet by the sync; here it simply has no centre to hang off.
    if (!centro) continue;

    // Likewise for a slot with neither its own hours nor a default: the sync
    // has already turned that into a verdict for the row's Validación cell.
    const horario = horarioDeJornada(fila.jornada, fila.horario);
    if (!horario) continue;

    const turno = armarTurno(centro, fila.fecha, fila.jornada, fila.cuposTotales, horario);
    turnos.set(turno.id, turno);
  }

  return [...turnos.values()];
}

/**
 * The hours a row runs at: its own column, or the slot's default.
 *
 * Null when neither exists, which the sync turns into a rejected row. Inventing
 * a schedule for a slot nobody has defined would publish an hour no coordinator
 * authorised, and a volunteer would show up to a closed door.
 */
export function horarioDeJornada(jornada: Jornada, horario: Horario | null): Horario | null {
  return horario ?? HORARIOS[jornada] ?? null;
}

function armarTurno(
  centro: Centro,
  fecha: string,
  jornada: Jornada,
  cuposTotales: number,
  horario: Horario,
): Turno {
  return {
    id: buildTurnoId(centro.id, fecha, jornada),
    centroId: centro.id,
    centroNombre: centro.nombre,
    fecha,
    diaSemana: diaSemanaDe(fecha),
    jornada,
    horario,
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
