import { httpClient } from "@/lib/http-client";
import type { Turno } from "@/types/volbogota";

/** GET /api/turnos/{id} — a single shift with live occupancy. Throws on 404. */
export default async function getTurnoById(id: string): Promise<Turno> {
  const { data } = await httpClient.get<Turno>(`/api/turnos/${encodeURIComponent(id)}`);
  return data;
}
