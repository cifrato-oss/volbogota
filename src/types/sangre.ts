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
 * Runs in the browser, always. Picking a type is a question — "where can I go
 * right now" — so a point that is not drawing blood today is not an answer to
 * it, and leaving it in only makes the donor filter the list again by eye. With
 * no type picked the list stays complete, closed points included, because then
 * the question is the broader "what is out there".
 *
 * A point that is open but has not listed its types does survive: "we did not
 * say" is not "no", and it might be the closest one that can take them.
 */
export function filtrarPorTipo(
  bancos: BancoSangreVista[],
  seleccion: SeleccionTipo,
): BancoSangreVista[] {
  if (!seleccion) return bancos;

  return bancos.filter(
    (banco) =>
      banco.recibiendoHoy &&
      (banco.tiposQueRecibe.length === 0 || banco.tiposQueRecibe.includes(seleccion)),
  );
}

/** A locality the donor can narrow to, and how many points it holds. */
export type ConteoLocalidad = { nombre: string; cuantos: number };

/**
 * The localities present in a list of banks, with counts.
 *
 * Derived from whatever list it is handed rather than from the full catalogue,
 * which is the point: called with the type-filtered banks, the chips answer
 * "where can I give O−" instead of offering localities that lead to an empty
 * list. A locality nobody serves today simply does not appear.
 *
 * Bogotá has twenty localities and this product will never fill them all, so
 * the list is built from the data and not from a constant somebody has to keep
 * in step with the spreadsheet.
 */
export function localidadesDe(bancos: BancoSangreVista[]): ConteoLocalidad[] {
  const cuenta = new Map<string, number>();

  for (const banco of bancos) {
    const nombre = banco.localidad?.trim();
    if (!nombre) continue;
    cuenta.set(nombre, (cuenta.get(nombre) ?? 0) + 1);
  }

  return [...cuenta.entries()]
    .map(([nombre, cuantos]) => ({ nombre, cuantos }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * Narrows to one locality.
 *
 * A bank with no locality survives every filter: the cell is blank in the sheet
 * often enough, and hiding a point because a column was not filled would be the
 * spreadsheet's gap turned into a donor's missing option.
 */
export function filtrarPorLocalidad(
  bancos: BancoSangreVista[],
  localidad: string | null,
): BancoSangreVista[] {
  if (!localidad) return bancos;

  return bancos.filter((banco) => !banco.localidad?.trim() || banco.localidad.trim() === localidad);
}
