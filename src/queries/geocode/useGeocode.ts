import { useQuery } from "@tanstack/react-query";

import geocodeAddress from "@/services/geocode/geocodeAddress";

/**
 * Geocodes an address to coordinates. Disabled until a query is provided, and
 * cached indefinitely — a street address doesn't move, so we never re-fetch it.
 */
export default function useGeocode(query: string | null) {
  return useQuery({
    queryKey: ["geocode", query],
    queryFn: () => geocodeAddress(query as string),
    enabled: Boolean(query),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}
