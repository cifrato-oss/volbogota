/**
 * Coordinates for a blood bank, taken from the Google Maps link the sheet
 * already carries.
 *
 * The alternative was geocoding the address, and it does not work here: a
 * Colombian street address — "Cra. 104B #152B-40" — is almost never in
 * OpenStreetMap, so every lookup fell through to the locality, and every bank in
 * Suba landed on Suba's centroid. Two points stacked on one pin, which reads as
 * a missing point rather than an imprecise one, and a pin on a centroid claims
 * "the bank is here" when it means "somewhere in this locality".
 *
 * A coordinator pasting a Maps link has already done the geocoding by hand, and
 * done it right — they looked at the place. This just reads their answer.
 */

export type Punto = { lat: number; lng: number };

/**
 * Pulls coordinates out of a resolved Google Maps URL.
 *
 * `!3d…!4d…` is preferred over `@…`: the first is where the pin sits, the second
 * is where the camera sits, and they differ whenever the map opened off-centre.
 */
export function coordenadasDeUrl(url: string): Punto | null {
  const marcador = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (marcador) return puntoDe(marcador[1]!, marcador[2]!);

  const camara = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (camara) return puntoDe(camara[1]!, camara[2]!);

  // `?q=4.61,-74.08` and `?query=4.61,-74.08`, which is what a link built by
  // hand tends to look like.
  const consulta =
    url.match(/[?&](?:q|query|ll)=(-?\d+\.\d+)%2C(-?\d+\.\d+)/i) ??
    url.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/i);
  if (consulta) return puntoDe(consulta[1]!, consulta[2]!);

  return null;
}

function puntoDe(lat: string, lng: string): Punto | null {
  const punto = { lat: Number(lat), lng: Number(lng) };
  return dentroDeBogota(punto) ? punto : null;
}

/**
 * A loose box around Bogotá and its surroundings.
 *
 * Guards against reading a number that is not a coordinate — a link that changed
 * shape, or an id that happens to match the pattern. A pin in the wrong
 * hemisphere is worse than no pin: it is silently wrong, and the donor has no
 * way to tell.
 */
function dentroDeBogota({ lat, lng }: Punto): boolean {
  return lat > 3.8 && lat < 5.2 && lng > -74.6 && lng < -73.7;
}

/**
 * Follows a short link far enough to read its coordinates.
 *
 * `maps.app.goo.gl` links carry nothing on their own; the coordinates appear
 * only in the URL they redirect to. Runs on the server during a sync, never in a
 * browser: it is one request per bank, and the result is stored so it happens
 * once per link rather than once per visitor.
 */
export async function resolverCoordenadas(linkMaps: string | null): Promise<Punto | null> {
  if (!linkMaps) return null;

  const directo = coordenadasDeUrl(linkMaps);
  if (directo) return directo;

  try {
    const respuesta = await fetch(linkMaps, {
      redirect: "follow",
      // Google serves a consent interstitial without one, and that page has no
      // coordinates in its URL.
      headers: { "user-agent": "Mozilla/5.0 (compatible; volbogota/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });

    return coordenadasDeUrl(respuesta.url) ?? coordenadasDeUrl(await respuesta.text());
  } catch {
    // A link that will not resolve is not an error worth failing a sync over.
    // The bank keeps its card and simply gets no pin.
    return null;
  }
}
