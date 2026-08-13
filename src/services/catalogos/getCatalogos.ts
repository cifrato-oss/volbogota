import { httpClient } from "@/lib/http-client";
import type { Catalogos } from "@/types/volbogota";

/** GET /api/catalogos — all dropdown data (centers, shifts, activities, dates). */
export default async function getCatalogos(): Promise<Catalogos> {
  const { data } = await httpClient.get<Catalogos>("/api/catalogos");
  return data;
}
