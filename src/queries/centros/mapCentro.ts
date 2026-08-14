import type { Actividad, Centro, Jornada } from "@/types/volbogota";

/**
 * Maps a raw Firestore `centros` document to the client `Centro` shape.
 *
 * Mirrors the server's `centroSchema` projection minus `coordinador`, which the
 * public API deliberately omits (it carries a phone number). Values are read
 * defensively — a missing field falls back rather than throwing — so one
 * malformed import doesn't blank the whole live list.
 */
export function mapCentro(id: string, data: Record<string, unknown>): Centro {
  const cupos = (data.cuposPorJornada ?? {}) as Partial<Record<Jornada, unknown>>;

  return {
    id,
    nombre: (data.nombre as string | undefined) ?? "",
    direccion: (data.direccion as string | null | undefined) ?? null,
    localidad: (data.localidad as string | null | undefined) ?? null,
    linkMaps: (data.linkMaps as string | null | undefined) ?? null,
    horarioOficial: (data.horarioOficial as string | null | undefined) ?? null,
    observaciones: (data.observaciones as string | null | undefined) ?? null,
    actividades: Array.isArray(data.actividades) ? (data.actividades as Actividad[]) : [],
    cuposPorJornada: {
      AM: Number(cupos.AM ?? 0) || 0,
      PM: Number(cupos.PM ?? 0) || 0,
    },
    activo: data.activo === true,
  };
}
