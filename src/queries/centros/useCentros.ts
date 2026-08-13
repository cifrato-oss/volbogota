import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/queries/queryKeys";
import getCentros from "@/services/centros/getCentros";

/** Loads all active centers. */
export default function useCentros() {
  return useQuery({
    queryKey: queryKeys.centros.all,
    queryFn: getCentros,
    staleTime: 5 * 60 * 1000,
  });
}
