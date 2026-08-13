import { notFound } from "@/server/http/errors";

import {
  findCentroById,
  findCentros,
  findTurnoById,
  findTurnos,
  type TurnoFilters,
} from "./catalogo.repository";
import {
  ACTIVIDADES,
  ETIQUETA_JORNADA,
  HORARIOS,
  JORNADAS,
  toTurnoPublico,
  type Centro,
  type Jornada,
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

export type Disponibilidad = {
  fechas: string[];
  centros: Array<{
    id: string;
    nombre: string;
    localidad: string | null;
    dias: Array<{
      fecha: string;
      jornadas: Array<{
        jornada: Jornada;
        turnoId: string;
        cuposTotales: number;
        disponibles: number;
        agotado: boolean;
        estado: TurnoPublico["estado"];
      }>;
    }>;
  }>;
  totales: {
    cupos: number;
    reservados: number;
    disponibles: number;
  };
};

/**
 * The whole centre × date × shift grid in one response, so the booking calendar
 * renders without firing a request per cell.
 */
export async function obtenerDisponibilidad(): Promise<Disponibilidad> {
  const [centros, turnos] = await Promise.all([listarCentros(), listarTurnos()]);

  const fechas = [...new Set(turnos.map((turno) => turno.fecha))].sort();

  const centrosConDias = centros.map((centro) => {
    const delCentro = turnos.filter((turno) => turno.centroId === centro.id);

    return {
      id: centro.id,
      nombre: centro.nombre,
      localidad: centro.localidad,
      dias: fechas.map((fecha) => ({
        fecha,
        jornadas: delCentro
          .filter((turno) => turno.fecha === fecha)
          .map((turno) => ({
            jornada: turno.jornada,
            turnoId: turno.id,
            cuposTotales: turno.cuposTotales,
            disponibles: turno.disponibles,
            agotado: turno.agotado,
            estado: turno.estado,
          })),
      })),
    };
  });

  return {
    fechas,
    centros: centrosConDias,
    totales: {
      cupos: turnos.reduce((total, turno) => total + turno.cuposTotales, 0),
      reservados: turnos.reduce((total, turno) => total + turno.reservados, 0),
      disponibles: turnos.reduce((total, turno) => total + turno.disponibles, 0),
    },
  };
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
