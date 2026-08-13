import { httpClient } from "@/lib/http-client";
import type { CreateReservaInput, Reserva } from "@/types/volbogota";

/**
 * POST /api/reservas — enroll a volunteer in a shift.
 *
 * Throws `ApiClientError` on 409 (shift full/closed or duplicate phone) and
 * 422 (validation; `error.details` holds `ValidationErrorDetail[]`).
 */
export default async function createReserva(input: CreateReservaInput): Promise<Reserva> {
  const { data } = await httpClient.post<Reserva>("/api/reservas", input);
  return data;
}
