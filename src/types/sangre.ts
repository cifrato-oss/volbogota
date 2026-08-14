/**
 * Client-side vocabulary for the "Quiero donar sangre" flow.
 *
 * Kept out of `src/server` on purpose: components import this, and the ESLint
 * boundary stops them from reaching into server modules.
 */

/** The eight ABO/Rh combinations, in the order the picker lays them out. */
export const TIPOS_SANGRE = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;
export type TipoSangre = (typeof TIPOS_SANGRE)[number];

/**
 * What a donor picked on the self-assessment screen.
 *
 * `null` is "I don't know", which is a real answer and not a missing one: it
 * shows every bank instead of none, because a donor who does not know their type
 * can still donate — they get told at the door.
 *
 * This value lives in React state and nowhere else. Not in `localStorage`, not
 * in the URL, not in a request. A blood type is sensitive health data under Ley
 * 1581, and the screen promises in writing that it is discarded on exit.
 */
export type SeleccionTipo = TipoSangre | null;

export type BancoSangreVista = {
  id: string;
  nombre: string;
  direccion: string | null;
  localidad: string | null;
  horarioOficial: string | null;
  linkMaps: string | null;
  tiposQueRecibe: TipoSangre[];
  /** What the coordinator wrote — "O+, RH-" — for the card to show verbatim. */
  resumenTipos: string | null;
  /** Whether the bank is drawing blood at all today. */
  recibiendoHoy: boolean;
  actualizadoEn: string | null;
  /** Whether the bank confirmed its list today, in Bogotá time. */
  reportoHoy: boolean;
};

/**
 * Whether a timestamp falls on today's date in Bogotá.
 *
 * This is what turns a stored timestamp into the "sin reporte hoy" state, so it
 * has to be Bogotá's day and not the browser's: a donor abroad checking on a
 * relative's behalf should see the same thing a donor in Bogotá sees.
 */
export function reportoHoy(actualizadoEn: string | null | undefined): boolean {
  if (!actualizadoEn) return false;

  const fecha = new Date(actualizadoEn);
  if (Number.isNaN(fecha.getTime())) return false;

  const enBogota = (valor: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(valor);

  return enBogota(fecha) === enBogota(new Date());
}

/** `2026-08-14T12:12:00Z` → `7:12 a.m.`, the way the card shows it. */
export function horaEnBogota(actualizadoEn: string | null | undefined): string | null {
  if (!actualizadoEn) return null;

  const fecha = new Date(actualizadoEn);
  if (Number.isNaN(fecha.getTime())) return null;

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(fecha);
}

/**
 * Which banks to show for a given selection.
 *
 * Runs in the browser, always. A bank that has not reported today is kept rather
 * than hidden: the card says so and points at its Maps listing, which is more
 * useful to a donor than a shorter list that quietly drops options.
 */
export function filtrarPorTipo(
  bancos: BancoSangreVista[],
  seleccion: SeleccionTipo,
): BancoSangreVista[] {
  if (!seleccion) return bancos;

  return bancos.filter(
    (banco) =>
      // Kept when nobody has answered, or when the answer includes this type.
      // A bank that said "no" today is kept too — the card says so, and a donor
      // deciding between five points is better served by a complete picture than
      // by a shorter list that drops options without explaining.
      !banco.reportoHoy || !banco.recibiendoHoy || banco.tiposQueRecibe.includes(seleccion),
  );
}
