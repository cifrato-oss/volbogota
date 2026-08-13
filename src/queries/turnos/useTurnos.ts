import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/queries/queryKeys";
import getTurnos from "@/services/turnos/getTurnos";
import type { TurnosQuery } from "@/types/volbogota";

/**
 * Loads shifts with live occupancy for the given filters.
 *
 * Occupancy drifts as others enroll, so this refetches periodically to keep the
 * quota selector honest (see the spec's polling recommendation).
 */
export default function useTurnos(query: TurnosQuery = {}) {
  return useQuery({
    queryKey: queryKeys.turnos.list(query),
    queryFn: () => getTurnos(query),
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}
