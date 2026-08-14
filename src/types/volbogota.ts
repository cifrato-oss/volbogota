/**
 * Domain contracts for the VolBogotá API.
 *
 * These mirror the payloads returned inside the `ApiResponse` envelope
 * (see `@/types/api`). Every field is typed strictly against the API spec —
 * literal unions for closed sets, `| null` for nullable fields.
 */

/** Shift period. Always uppercase. `AM` 8:00 a.m.–2:00 p.m., `PM` 1:00–5:00 p.m. */
export type Jornada = "AM" | "PM";

/** Volunteer activity. Closed set enforced by the API on POST. */
export type Actividad = "Empaque" | "Clasificación" | "Carga y descarga";

/** Shift lifecycle state. */
export type EstadoTurno = "ABIERTO" | "CERRADO";

/** Reservation lifecycle state. */
export type EstadoReserva = "RESERVADO";

/** Human-readable schedule for a shift period. */
export interface Horario {
  inicio: string;
  fin: string;
  etiqueta: string;
}

// --- GET /api/catalogos ---------------------------------------------------

export interface CatalogoCentro {
  id: string;
  nombre: string;
  localidad: string;
  actividades: Actividad[];
}

export interface CatalogoJornada {
  valor: Jornada;
  etiqueta: string;
  horario: Horario;
}

export interface Catalogos {
  centros: CatalogoCentro[];
  jornadas: CatalogoJornada[];
  actividades: Actividad[];
  /** ISO dates (YYYY-MM-DD). */
  fechas: string[];
}

// --- GET /api/centros[, /:id] --------------------------------------------

export interface Centro {
  id: string;
  nombre: string;
  direccion: string | null;
  localidad: string | null;
  linkMaps: string | null;
  /**
   * When the point is actually open, e.g. "8:00 a.m. - 9:00 p.m." or
   * "24 horas". NOT the same as the shift schedule — CC Unicentro opens at
   * 9:00 a.m., not 8:00. Show this one.
   */
  horarioOficial: string | null;
  /**
   * Free-form operational notes from the coordinators. This is where the file
   * says Palacio de los Deportes collects for Chocó rather than for the Bogotá
   * earthquake, so it is worth surfacing.
   */
  observaciones: string | null;
  /** Informational — what happens at the point. Not a form field. */
  actividades: Actividad[];
  /**
   * Nominal capacity per shift slot. Keys are whatever the sheet names — not
   * limited to AM/PM (e.g. "MADRUGADA", "TARDE"). A `0` means the point does
   * not operate that shift.
   */
  cuposPorJornada: Record<string, number>;
  activo: boolean;
}

// --- GET /api/turnos[, /:id] ---------------------------------------------

export interface Turno {
  id: string;
  centroId: string;
  centroNombre: string;
  /** ISO date (YYYY-MM-DD). */
  fecha: string;
  diaSemana: string;
  /** Shift period as stored in Firestore — not limited to AM/PM (e.g. "TARDE 1"). */
  jornada: string;
  /** Nominal schedule of the shift. */
  horario: Horario;
  /** The point's real opening hours, denormalized. Prefer this when showing times. */
  horarioOficialCentro: string | null;
  centroActivo: boolean;
  cuposTotales: number;
  reservados: number;
  estado: EstadoTurno;
  coordinador: string | null;
  /** `cuposTotales - reservados`, never negative. */
  disponibles: number;
  /** Occupancy ratio, 0–1. Multiply by 100 for a percentage. */
  ocupacion: number;
  /** `true` when `disponibles === 0`. */
  agotado: boolean;
}

/** Query filters for `GET /api/turnos` — all optional and combinable. */
export interface TurnosQuery {
  centro?: string;
  /** ISO date (YYYY-MM-DD). */
  fecha?: string;
  jornada?: Jornada;
  /** When `true`, hides full/closed shifts. */
  disponibles?: boolean;
}

// --- POST /api/reservas ---------------------------------------------------

export interface CreateReservaInput {
  /** 2–60 chars; trimmed by the API. */
  nombre: string;
  /** 2–60 chars; trimmed by the API. */
  apellido: string;
  /** Colombian format: 10 digits starting with 3. Separators are normalized. */
  celular: string;
  /** Integer, 18 or more. The API also accepts a numeric string. */
  edad: number;
  /** Use a `Turno.id` from `GET /api/turnos`. */
  turnoId: string;
  /** Must be `true`, or the API answers 422. */
  autorizoDatos: boolean;
  /**
   * Emergency phone. Optional, up to 40 chars, and deliberately not held to the
   * volunteer's own `3XXXXXXXXX` rule — it is often a landline or a relative
   * abroad. Lands in the sheet's `Cel. emergencia` column.
   */
  contactoEmergencia?: string | null;
  /** Health provider. Optional, up to 80 chars. Lands in the sheet's `EPS` column. */
  eps?: string | null;
}

export interface ReservaTurnoResumen {
  id: string;
  centroNombre: string;
  /** ISO date (YYYY-MM-DD). */
  fecha: string;
  /** Display label ready to show, e.g. "AM". */
  jornada: string;
  /** Already-formatted schedule label, e.g. "8:00 a.m. - 2:00 p.m.". */
  horario: string;
  /** So the confirmation screen can say where to go without another request. */
  direccion: string | null;
  horarioOficial: string | null;
}

export interface Reserva {
  /**
   * Confirmation code shown to the volunteer, e.g. "VB-K7M2QX9D". Eight symbols
   * with no O/0 or I/1/L so it survives being dictated at a collection point.
   */
  codigo: string;
  estado: EstadoReserva;
  /** Name and surname already joined. */
  nombre: string;
  turno: ReservaTurnoResumen;
}

/** Shape of each item in `ApiFailure.error.details` on a 422 response. */
export interface ValidationErrorDetail {
  /** Field name, e.g. `celular` or `edad`. */
  field: string;
  message: string;
}
