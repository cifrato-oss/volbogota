import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/queries/queryKeys";
import getCatalogos from "@/services/catalogos/getCatalogos";

/** Loads all dropdown data. Catalogs rarely change, so cache them generously. */
export default function useCatalogos() {
  return useQuery({
    queryKey: queryKeys.catalogos,
    queryFn: getCatalogos,
    staleTime: 5 * 60 * 1000,
  });
}
