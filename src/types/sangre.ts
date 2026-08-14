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
 * A single type and not a set: a person has one. Offering multiple selection
 * would model something that does not exist, and with a handful of banks on one
 * screen the picker is not there to shorten the list anyway — it is there to say
 * which of them is useful to this person.
 *
 * This value lives in React state and nowhere else. Not in `localStorage`, not
 * in the URL, not in a request. A blood type is sensitive health data under Ley
 * 1581, and the screen promises in writing that it is discarded on exit.
 */
export type SeleccionTipo = TipoSangre | null;

/**
 * A blood bank as the screen shows it.
 *
 * Everything here is asserted by a person in the spreadsheet. There is
 * deliberately no freshness field: the only timestamp available is the moment
 * our own sync wrote to Firestore, which says nothing about whether a
 * coordinator confirmed anything. Showing it as "actualizado 8:12 a.m." dressed
 * a machine's clock up as a human's answer, and derived a "sin reporte hoy"
 * state the sheet never claims. `Recibiendo hoy` is that claim, and a person
 * maintains it.
 */
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
};

/**
 * Which banks to show for a given selection.
 *
 * Runs in the browser, always. Two kinds of bank survive a filter that does not
 * match them, and both on purpose: one that is closed today, because a donor
 * choosing between a handful of points is better served by a complete picture
 * than by a shorter list that drops options without saying so; and one that is
 * open but has not listed its types, because "we did not say" is not "no".
 */
export function filtrarPorTipo(
  bancos: BancoSangreVista[],
  seleccion: SeleccionTipo,
): BancoSangreVista[] {
  if (!seleccion) return bancos;

  return bancos.filter(
    (banco) =>
      !banco.recibiendoHoy ||
      banco.tiposQueRecibe.length === 0 ||
      banco.tiposQueRecibe.includes(seleccion),
  );
}
