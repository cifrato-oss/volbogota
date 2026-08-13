import { httpClient } from "@/lib/http-client";
import type { Centro } from "@/types/volbogota";

/** GET /api/centros/{id} — a single center by slug id. Throws on 404. */
export default async function getCentroById(id: string): Promise<Centro> {
  const { data } = await httpClient.get<Centro>(`/api/centros/${encodeURIComponent(id)}`);
  return data;
}
