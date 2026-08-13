import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/queries/queryKeys";
import getDisponibilidad from "@/services/disponibilidad/getDisponibilidad";

/**
 * Loads the full availability grid for calendar rendering.
 *
 * Polls every 30s so the calendar reflects live quota changes without
 * per-cell requests (see the spec's polling recommendation).
 */
export default function useDisponibilidad() {
  return useQuery({
    queryKey: queryKeys.disponibilidad,
    queryFn: getDisponibilidad,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });
}
