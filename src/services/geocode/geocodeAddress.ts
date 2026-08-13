export type GeoPoint = { lat: number; lng: number };

/**
 * Resolves a free-text address to coordinates via Nominatim (OpenStreetMap's
 * free, keyless geocoder). Used only to place a map pin — the authoritative
 * directions link is the center's `linkMaps`.
 *
 * Nominatim's usage policy asks for low volume; results are cached forever by
 * the query hook (addresses don't move), so a center is geocoded at most once.
 */
export default async function geocodeAddress(query: string): Promise<GeoPoint | null> {
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
