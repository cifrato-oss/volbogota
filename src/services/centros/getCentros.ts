import { httpClient } from "@/lib/http-client";
import type { Centro } from "@/types/volbogota";

/** GET /api/centros — all active centers, ordered alphabetically. */
export default async function getCentros(): Promise<Centro[]> {
  const { data } = await httpClient.get<Centro[]>("/api/centros");
  return data;
}
