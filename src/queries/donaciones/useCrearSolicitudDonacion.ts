import { useMutation } from "@tanstack/react-query";

import crearSolicitudDonacion from "@/services/donaciones/crearSolicitudDonacion";
import type { SolicitudDonacionConfirmacion, SolicitudDonacionInput } from "@/types/donaciones";

/**
 * Registers a donor's selected items for a center.
 *
 * The endpoint is a stateless mock for now, so there is nothing to invalidate:
 * callers read `mutation.data.codigo` on success and handle `ApiClientError`
 * (422 validation) from `mutateAsync` / `onError`.
 */
export default function useCrearSolicitudDonacion() {
  return useMutation<SolicitudDonacionConfirmacion, unknown, SolicitudDonacionInput>({
    mutationFn: crearSolicitudDonacion,
  });
}
