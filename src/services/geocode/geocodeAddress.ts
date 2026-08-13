export type GeoPoint = { lat: number; lng: number };

async function search(query: string): Promise<GeoPoint | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "co");

  const response = await fetch(url, { headers: { "Accept-Language": "es" } });
  if (!response.ok) {
    throw new Error(`Geocode failed: ${response.status}`);
  }

  const results = (await response.json()) as Array<{ lat: string; lon: string }>;
  const first = results[0];
  if (!first) return null;

  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}

/**
 * Resolves a location to coordinates via Nominatim (OpenStreetMap's free,
 * keyless geocoder), trying candidate queries in order — exact address first,
 * then coarser fallbacks (locality, name) — until one resolves.
 *
 * Colombian street addresses (e.g. "Calle 161A # 7F-55") sometimes return no
 * result, so the locality fallback still drops a pin in the right area. The
 * center's `linkMaps` remains the authoritative directions link.
 *
 * Results are cached forever by the query hook (a location doesn't move), so a
 * center is geocoded at most once and the fallbacks rarely fire more than once.
 */
export default async function geocodeAddress(queries: string[]): Promise<GeoPoint | null> {
  for (const query of queries) {
    if (!query.trim()) continue;
    const point = await search(query);
    if (point) return point;
  }
  return null;
}
