import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/queries/queryKeys";
import getCentroById from "@/services/centros/getCentroById";

/** Loads a single center by id. Disabled until an id is provided. */
export default function useCentro(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.centros.detail(id ?? ""),
    queryFn: () => getCentroById(id as string),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  });
}
