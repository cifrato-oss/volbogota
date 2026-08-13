import { useQuery } from "@tanstack/react-query";

import geocodeAddress from "@/services/geocode/geocodeAddress";

/**
 * Geocodes a location from ordered candidate queries. Disabled until at least
 * one is provided, and cached indefinitely — a location doesn't move, so we
 * never re-fetch it.
 */
export default function useGeocode(queries: string[]) {
  return useQuery({
    queryKey: ["geocode", queries],
    queryFn: () => geocodeAddress(queries),
    enabled: queries.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}
