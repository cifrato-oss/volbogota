import { badRequest, notFound } from "@/server/http/errors";

import {
  cerrarTurnosAusentes,
  desactivarCentrosAusentes,
  findCentroById,
  findCentros,
  findTurnoById,
  findTurnos,
  guardarCentros,
  guardarTurnos,
  refrescarCentroEnTurnos,
  type TurnoFilters,
} from "./catalogo.repository";
import {
  ACTIVIDADES,
  construirTurnos,
  etiquetaJornada,
  resolverCentroId,
  toTurnoPublico,
  type Centro,
  type TurnoDeHoja,
  type TurnoPublico,
} from "./catalogo.schema";

/** Public view of a centre: the coordinator's phone number is not for the world. */
export type CentroPublico = Omit<Centro, "coordinador">;

function toCentroPublico({ coordinador: _coordinador, ...centro }: Centro): CentroPublico {
  return centro;
}

export async function listarCentros(): Promise<CentroPublico[]> {
  const centros = await findCentros(true);
  return centros.map(toCentroPublico);
}

export async function obtenerCentro(id: string): Promise<CentroPublico> {
  const centro = await findCentroById(id);
  if (!centro || !centro.activo) {
    throw notFound("El centro de acopio no existe.");
  }

  return toCentroPublico(centro);
}

export type ListarTurnosOptions = TurnoFilters & {
  /** Drop shifts that are full or closed — what the booking form wants. */
  soloDisponibles?: boolean;
};

export async function listarTurnos({
  soloDisponibles = false,
  ...filters
}: ListarTurnosOptions = {}): Promise<TurnoPublico[]> {
  const turnos = (await findTurnos(filters)).map(toTurnoPublico);

  if (!soloDisponibles) return turnos;
  return turnos.filter((turno) => turno.estado === "ABIERTO" && !turno.agotado);
}

export async function obtenerTurno(id: string): Promise<TurnoPublico> {
  const turno = await findTurnoById(id);
  if (!turno) {
    throw notFound("El turno no existe.");
  }

  return toTurnoPublico(turno);
}

export type SincronizacionCatalogo = {
  centros: number;
  /** Shifts whose copy of the centre's fields was re-stamped. */
  turnos: number;
  /** Points that disappeared from the sheet and were retired. */
  desactivados: string[];
};

/**
 * Applies a `Centros` edit: the points, and only the points.
 *
 * That sheet is informative — where a point is, when it opens, what it holds
 * nominally — and no longer creates shifts. Deriving them here is what made a
 * one-cell edit rebuild the whole board and flatten the per-day capacity the
 * `Turnos` sheet had authorised; now the board owns its own numbers and this
 * sync only re-stamps the fields each shift keeps a copy of.
 */
export async function sincronizarCentros(centros: Centro[]): Promise<SincronizacionCatalogo> {
  const guardados = await guardarCentros(centros);
  const desactivados = await desactivarCentrosAusentes(centros.map((centro) => centro.id));
  const turnos = await refrescarCentroEnTurnos(centros);

  return { centros: guardados, turnos, desactivados };
}

/** Ids of the points no board row could be attached to, through the same resolver. */
function desconocidos(centros: Centro[], filas: TurnoDeHoja[]): string[] {
  const conocidos = new Set(centros.map((centro) => centro.id));

  return [
    ...new Set(
      filas
        .filter((fila) => resolverCentroId(fila.puntoDeAcopio, conocidos) === null)
        .map((fila) => fila.centroId),
    ),
  ];
}

export type SincronizacionTurnos = {
  turnos: number;
  fechas: string[];
  /** Points a row named that the catalogue does not have, for the sheet to flag. */
  centrosDesconocidos: string[];
  /** Shifts the board stopped listing, closed rather than deleted. */
  cerrados: string[];
};

/**
 * Applies an edit to the `Turnos` board — the only thing that creates a shift.
 *
 * The whole board arrives on every edit, so this is a full replacement: rows
 * become shifts, and a shift the board stopped listing is closed. Points are
 * read from Firestore rather than taken from the payload, because this hook
 * moves capacity around — it must never retire a point the way `Centros` can.
 */
export async function sincronizarTurnos(filas: TurnoDeHoja[]): Promise<SincronizacionTurnos> {
  const centros = await findCentros(false);
  const turnos = construirTurnos(centros, filas);

  if (turnos.length === 0) {
    throw badRequest("Ninguna fila del tablero nombra un punto de acopio conocido.");
  }

  const guardados = await guardarTurnos(turnos);
  const cerrados = await cerrarTurnosAusentes(turnos);

  return {
    turnos: guardados,
    fechas: [...new Set(turnos.map((turno) => turno.fecha))].sort(),
    centrosDesconocidos: desconocidos(centros, filas),
    cerrados,
  };
}

/**
 * Everything the booking form needs to populate its selects.
 *
 * The shifts are derived from the board rather than from a constant: the slots
 * are open-ended now, so the only honest answer to "which shifts exist" is the
 * ones the `Turnos` sheet actually loaded. Each carries the hours it really
 * runs at, taken from the first shift that uses it.
 */
export async function obtenerCatalogos() {
  const [centros, turnos] = await Promise.all([listarCentros(), listarTurnos()]);

  const porJornada = new Map<string, (typeof turnos)[number]>();
  for (const turno of turnos) {
    if (!porJornada.has(turno.jornada)) porJornada.set(turno.jornada, turno);
  }

  return {
    centros: centros.map((centro) => ({
      id: centro.id,
      nombre: centro.nombre,
      localidad: centro.localidad,
      actividades: centro.actividades,
    })),
    jornadas: [...porJornada.values()]
      .sort((a, b) => a.horario.inicio.localeCompare(b.horario.inicio))
      .map((turno) => ({
        valor: turno.jornada,
        etiqueta: etiquetaJornada(turno.jornada),
        horario: turno.horario,
      })),
    actividades: [...ACTIVIDADES],
    fechas: [...new Set(turnos.map((turno) => turno.fecha))].sort(),
  };
}
