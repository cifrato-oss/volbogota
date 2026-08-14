import { httpClient } from "@/lib/http-client";
import type { SolicitudDonacionConfirmacion, SolicitudDonacionInput } from "@/types/donaciones";

/**
 * POST /api/donaciones/solicitudes — register a donor's selected items.
 *
 * Throws `ApiClientError` on 422 (validation; `error.details` holds
 * `ValidationErrorDetail[]`).
 */
export default async function crearSolicitudDonacion(
  input: SolicitudDonacionInput,
): Promise<SolicitudDonacionConfirmacion> {
  const { data } = await httpClient.post<SolicitudDonacionConfirmacion>(
    "/api/donaciones/solicitudes",
    input,
  );
  return data;
}
