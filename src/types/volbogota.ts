/**
 * Domain contracts for the VolBogotá API.
 *
 * These mirror the payloads returned inside the `ApiResponse` envelope
 * (see `@/types/api`). Every field is typed strictly against the API spec —
 * literal unions for closed sets, `| null` for nullable fields.
 */

/** Shift period. Always uppercase. */
export type Jornada = "AM" | "PM" | "NOCHE";

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
  /** Only some centers have a street address. */
  direccion: string | null;
  localidad: string;
  linkMaps: string | null;
  actividades: Actividad[];
  cuposPorJornada: Record<Jornada, number>;
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
  jornada: Jornada;
  horario: Horario;
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

// --- GET /api/disponibilidad ---------------------------------------------

export interface DisponibilidadJornada {
  jornada: Jornada;
  turnoId: string;
  cuposTotales: number;
  disponibles: number;
  agotado: boolean;
  estado: EstadoTurno;
}

export interface DisponibilidadDia {
  /** ISO date (YYYY-MM-DD). */
  fecha: string;
  /** Ordered AM → PM → NOCHE. */
  jornadas: DisponibilidadJornada[];
}

export interface DisponibilidadCentro {
  id: string;
  nombre: string;
  localidad: string;
  /** One entry per date in `Disponibilidad.fechas`, same order. */
  dias: DisponibilidadDia[];
}

export interface DisponibilidadTotales {
  cupos: number;
  reservados: number;
  disponibles: number;
}

export interface Disponibilidad {
  /** ISO dates (YYYY-MM-DD). */
  fechas: string[];
  centros: DisponibilidadCentro[];
  totales: DisponibilidadTotales;
}

// --- POST /api/reservas ---------------------------------------------------

export interface ContactoEmergencia {
  nombre: string;
  celular: string;
}

export interface CreateReservaInput {
  /** 3–120 chars; trimmed by the API. */
  nombre: string;
  /** Colombian format: 10 digits starting with 3. Separators are normalized. */
  celular: string;
  /** Use a `Turno.id` from `GET /api/turnos`. */
  turnoId: string;
  actividad: Actividad;
  /** Must be `true`. */
  autorizoDatos: boolean;
  /** Must be `true`. */
  mayorDeEdad: boolean;
  contactoEmergencia?: ContactoEmergencia;
  /** Max 80 chars. */
  eps?: string;
  /** Max 500 chars. */
  notas?: string;
}

export interface ReservaTurnoResumen {
  id: string;
  centroNombre: string;
  /** ISO date (YYYY-MM-DD). */
  fecha: string;
  jornada: Jornada;
  /** Already-formatted schedule label, e.g. "8:00 a.m. - 2:00 p.m.". */
  horario: string;
}

export interface Reserva {
  /** Confirmation code shown to the volunteer, e.g. "VB-GDRHOR". */
  codigo: string;
  estado: EstadoReserva;
  nombre: string;
  turno: ReservaTurnoResumen;
  actividad: Actividad;
}

/** Shape of each item in `ApiFailure.error.details` on a 422 response. */
export interface ValidationErrorDetail {
  /** Field path; nested fields use dot notation, e.g. `contactoEmergencia.celular`. */
  field: string;
  message: string;
}
