import { badRequest, notFound } from "@/server/http/errors";

import {
  desactivarCentrosAusentes,
  findCentroById,
  findCentros,
  findTurnoById,
  findTurnos,
  guardarCatalogo,
  type TurnoFilters,
} from "./catalogo.repository";
import {
  ACTIVIDADES,
  ETIQUETA_JORNADA,
  HORARIOS,
  JORNADAS,
  construirTurnos,
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
  turnos: number;
  /** Points that disappeared from the sheet and were retired. */
  desactivados: string[];
  fechas: string[];
  /** Points a board row named that the catalogue does not have. */
  centrosDesconocidos: string[];
};

/**
 * Applies a catalogue edit that came from the spreadsheet.
 *
 * The sheet is the authority here — it is where coordinators set capacity,
 * addresses and whether a point is still authorised — so its values overwrite
 * ours. The one thing it does not own is `reservados`, which the booking
 * transaction keeps and `guardarCatalogo` carries over. Lowering capacity below
 * what is already booked is therefore applied as written and leaves the shift
 * visibly oversold rather than silently dropping volunteers.
 */
export async function sincronizarCatalogo(
  centros: Centro[],
  fechas?: string[],
  filas: TurnoDeHoja[] = [],
): Promise<SincronizacionCatalogo> {
  const fechasEfectivas = await fechasEfectivasDe(fechas, filas);
  const turnos = construirTurnos(centros, fechasEfectivas, filas);

  const guardado = await guardarCatalogo(centros, turnos);
  const desactivados = await desactivarCentrosAusentes(centros.map((centro) => centro.id));

  return {
    ...guardado,
    desactivados,
    fechas: fechasEfectivas,
    centrosDesconocidos: desconocidos(centros, filas),
  };
}

function desconocidos(centros: Centro[], filas: TurnoDeHoja[]): string[] {
  const conocidos = new Set(centros.map((centro) => centro.id));
  return [...new Set(filas.map((f) => f.centroId).filter((id) => !conocidos.has(id)))];
}

export type SincronizacionTurnos = {
  turnos: number;
  fechas: string[];
  /** Points a row named that the catalogue does not have, for the sheet to flag. */
  centrosDesconocidos: string[];
};

/**
 * Applies an edit to the `Turnos` board, where the sheet states shifts one by one.
 *
 * The whole board is rebuilt, not just the rows that arrived: that is what makes
 * deleting a row mean "back to the capacity `Centros` gives it" instead of
 * leaving a shift frozen at a number nobody can see any more. Points are read
 * from Firestore rather than taken from the payload, because this hook moves
 * capacity around — it must never retire a point the way a `Centros` sync can.
 */
export async function sincronizarTurnos(filas: TurnoDeHoja[]): Promise<SincronizacionTurnos> {
  const centros = await findCentros(false);
  const fechas = await fechasEfectivasDe(undefined, filas);
  const turnos = construirTurnos(centros, fechas, filas);

  const guardado = await guardarCatalogo([], turnos);

  return { turnos: guardado.turnos, fechas, centrosDesconocidos: desconocidos(centros, filas) };
}

/**
 * The calendar to build over: what was sent, or what is already loaded, plus any
 * day a board row opens that neither covers.
 */
async function fechasEfectivasDe(fechas: string[] | undefined, filas: TurnoDeHoja[]) {
  const base = fechas?.length ? fechas : await fechasCargadas();
  const efectivas = [...new Set([...base, ...filas.map((f) => f.fecha)])].sort();

  if (efectivas.length === 0) {
    throw badRequest("No hay turnos cargados todavía: manda las fechas del programa.");
  }

  return efectivas;
}

async function fechasCargadas(): Promise<string[]> {
  const turnos = await findTurnos();
  return [...new Set(turnos.map((turno) => turno.fecha))];
}

/** Everything the booking form needs to populate its selects. */
export async function obtenerCatalogos() {
  const [centros, turnos] = await Promise.all([listarCentros(), listarTurnos()]);

  return {
    centros: centros.map((centro) => ({
      id: centro.id,
      nombre: centro.nombre,
      localidad: centro.localidad,
      actividades: centro.actividades,
    })),
    jornadas: JORNADAS.map((jornada) => ({
      valor: jornada,
      etiqueta: ETIQUETA_JORNADA[jornada],
      horario: HORARIOS[jornada],
    })),
    actividades: [...ACTIVIDADES],
    fechas: [...new Set(turnos.map((turno) => turno.fecha))].sort(),
  };
}
