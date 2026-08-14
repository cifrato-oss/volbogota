import type { Actividad, Centro } from "@/types/volbogota";

/** Reads `cuposPorJornada` for whatever slots the point has, not just AM/PM. */
function mapCupos(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const cupos: Record<string, number> = {};
  for (const [jornada, valor] of Object.entries(value as Record<string, unknown>)) {
    cupos[jornada] = Number(valor) || 0;
  }
  return cupos;
}

/**
 * Maps a raw Firestore `centros` document to the client `Centro` shape.
 *
 * Mirrors the server's `centroSchema` projection minus `coordinador`, which the
 * public API deliberately omits (it carries a phone number). Values are read
 * defensively — a missing field falls back rather than throwing — so one
 * malformed import doesn't blank the whole live list.
 */
export function mapCentro(id: string, data: Record<string, unknown>): Centro {
  return {
    id,
    nombre: (data.nombre as string | undefined) ?? "",
    direccion: (data.direccion as string | null | undefined) ?? null,
    localidad: (data.localidad as string | null | undefined) ?? null,
    linkMaps: (data.linkMaps as string | null | undefined) ?? null,
    horarioOficial: (data.horarioOficial as string | null | undefined) ?? null,
    observaciones: (data.observaciones as string | null | undefined) ?? null,
    actividades: Array.isArray(data.actividades) ? (data.actividades as Actividad[]) : [],
    cuposPorJornada: mapCupos(data.cuposPorJornada),
    activo: data.activo === true,
  };
}
