import { httpClient } from "@/lib/http-client";
import type { Disponibilidad } from "@/types/volbogota";

/** GET /api/disponibilidad — full center × date × shift grid plus aggregates. */
export default async function getDisponibilidad(): Promise<Disponibilidad> {
  const { data } = await httpClient.get<Disponibilidad>("/api/disponibilidad");
  return data;
}
