import type { EstadoTurno, Turno } from "@/types/volbogota";

/** `{nombre, celular}` in Firestore; the client only surfaces the name. */
function coordinadorToString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "nombre" in value) {
    const nombre = (value as { nombre?: unknown }).nombre;
    return typeof nombre === "string" ? nombre : null;
  }
  return null;
}

/**
 * Maps a raw Firestore `turnos` document to the client `Turno` shape, verbatim.
 *
 * Occupancy (`disponibles`/`ocupacion`/`agotado`) is derived here the same way
 * the API does it, so a booking that bumps `reservados` shows up live without a
 * refetch. Everything else is shown exactly as stored — name, date, day, shift,
 * schedule label, state.
 */
export function mapTurno(id: string, data: Record<string, unknown>): Turno {
  const horario = (data.horario ?? {}) as Record<string, unknown>;
  const cuposTotales = Number(data.cuposTotales ?? 0) || 0;
  const reservados = Number(data.reservados ?? 0) || 0;
  const disponibles = Math.max(0, cuposTotales - reservados);

  return {
    id,
    centroId: (data.centroId as string | undefined) ?? "",
    centroNombre: (data.centroNombre as string | undefined) ?? "",
    fecha: (data.fecha as string | undefined) ?? "",
    diaSemana: (data.diaSemana as string | undefined) ?? "",
    jornada: (data.jornada as string | undefined) ?? "",
    horario: {
      inicio: (horario.inicio as string | undefined) ?? "",
      fin: (horario.fin as string | undefined) ?? "",
      etiqueta: (horario.etiqueta as string | undefined) ?? "",
    },
    horarioOficialCentro: (data.horarioOficialCentro as string | null | undefined) ?? null,
    centroActivo: data.centroActivo === true,
    cuposTotales,
    reservados,
    estado: (data.estado as EstadoTurno | undefined) ?? "CERRADO",
    coordinador: coordinadorToString(data.coordinador),
    disponibles,
    ocupacion: cuposTotales === 0 ? 0 : reservados / cuposTotales,
    agotado: disponibles === 0,
  };
}
