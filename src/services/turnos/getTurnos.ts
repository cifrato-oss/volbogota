import { httpClient } from "@/lib/http-client";
import type { Turno, TurnosQuery } from "@/types/volbogota";

/** GET /api/turnos — shifts with live occupancy, optionally filtered. */
export default async function getTurnos(query: TurnosQuery = {}): Promise<Turno[]> {
  const { data } = await httpClient.get<Turno[]>("/api/turnos", {
    params: {
      centro: query.centro,
      fecha: query.fecha,
      jornada: query.jornada,
      disponibles: query.disponibles,
    },
  });
  return data;
}
