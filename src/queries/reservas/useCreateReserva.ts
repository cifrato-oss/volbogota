import { useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/queries/queryKeys";
import createReserva from "@/services/reservas/createReserva";
import type { CreateReservaInput, Reserva } from "@/types/volbogota";

/**
 * Enrolls a volunteer in a shift.
 *
 * Occupancy changes whether the booking succeeds or loses a race, so the shift
 * cache is invalidated on `onSettled` (both paths). That way a 409 ("shift full")
 * immediately refreshes the turnos — which is where live availability comes from
 * now that /api/disponibilidad is gone — instead of showing stale cupos until the
 * next poll. Callers should handle `ApiClientError` (409 quota/duplicate, 422
 * validation) from `mutateAsync` / `onError`.
 */
export default function useCreateReserva() {
  const queryClient = useQueryClient();

  return useMutation<Reserva, unknown, CreateReservaInput>({
    mutationFn: createReserva,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.turnos.all });
    },
  });
}
