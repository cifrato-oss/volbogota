import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/queries/queryKeys";
import createReserva from "@/services/reservas/createReserva";
import type { CreateReservaInput, Reserva } from "@/types/volbogota";

/**
 * Enrolls a volunteer in a shift.
 *
 * On success, occupancy changed, so the shift caches are invalidated. Callers
 * should handle `ApiClientError` (409 quota/duplicate, 422 validation) from
 * `mutateAsync` / `onError`.
 */
export default function useCreateReserva() {
  const queryClient = useQueryClient();

  return useMutation<Reserva, unknown, CreateReservaInput>({
    mutationFn: createReserva,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.turnos.all });
    },
  });
}
