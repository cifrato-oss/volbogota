import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/queries/queryKeys";
import getTurnoById from "@/services/turnos/getTurnoById";

/** Loads a single shift by id. Disabled until an id is provided. */
export default function useTurno(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.turnos.detail(id ?? ""),
    queryFn: () => getTurnoById(id as string),
    enabled: Boolean(id),
    staleTime: 15 * 1000,
  });
}
