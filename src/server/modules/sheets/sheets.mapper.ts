/**
 * Translation between the master spreadsheet and the API contract.
 *
 * The two disagree on almost every representation: the sheet writes dates as
 * `13/08/2026`, shift ids as `Punto Usaquén|2026-08-13|AM`, states as `Asistió`
 * and booleans as `Sí`. Firestore uses ISO dates, slugged ids, screaming-snake
 * states and real booleans. Keeping every conversion in one module means a
 * column that changes shape breaks here, loudly, instead of somewhere deep in a
 * sync where it would be read as a legitimately different value.
 *
 * The contract is the authority. Columns the sheet carries but the API does not
 * model — activity, EPS, emergency contact, WhatsApp reminder — are ignored on
 * the way in rather than widening the domain to match a spreadsheet.
 */

import { badRequest } from "@/server/http/errors";
import {
  buildTurnoId,
  normalizarJornada,
  slugify,
  type Horario,
  type Jornada,
} from "@/server/modules/catalogo/catalogo.schema";
import type { EstadoNecesidad } from "@/server/modules/donaciones/donaciones.schema";
import { ESTADOS_RESERVA, type EstadoReserva } from "@/server/modules/reservas/reservas.schema";

/** The sheet separates the parts of a shift id with pipes. */
const SEPARADOR_ID_SHEET = "|";

/** `13/08/2026` or an already-ISO `2026-08-13`. */
export function fechaDesdeSheet(valor: string): string {
  const texto = valor.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(texto);
  if (!match) {
    throw badRequest(`No entiendo la fecha "${valor}". Usa DD/MM/AAAA o AAAA-MM-DD.`);
  }

  const [, dia = "", mes = "", anio = ""] = match;

  // A month past 12 means the cell is M/D/YYYY, which this cannot disambiguate
  // from D/M/YYYY on a day under 13. Rejecting beats storing `2026-15-08`,
  // which passes the ISO shape and is silently wrong from then on.
  if (Number(mes) > 12 || Number(mes) < 1 || Number(dia) < 1 || Number(dia) > 31) {
    throw badRequest(`No entiendo la fecha "${valor}". Usa DD/MM/AAAA o AAAA-MM-DD.`);
  }

  return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
}

/** `2026-08-13` → `13/08/2026`, for writing back into the sheet. */
export function fechaHaciaSheet(iso: string): string {
  const [anio = "", mes = "", dia = ""] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

/**
 * The sheet's `Jornada` column, case- and accent-insensitive.
 *
 * No longer checked against a closed list: the board is the authority on which
 * slots run, and the programme opens new ones — `MADRUGADA 1`, `MADRUGADA 2` —
 * without asking. What used to guard against a typo now guards nothing a
 * coordinator cannot see, and a row is instead rejected further down when its
 * slot states no schedule.
 */
export function jornadaDesdeSheet(valor: string): Jornada {
  const jornada = normalizarJornada(valor);

  if (!jornada) {
    throw badRequest("La jornada está vacía.");
  }

  return jornada;
}

/** The range separators a coordinator actually types between two times. */
const SEPARADOR_HORARIO = /\s*(?:-|–|—|\ba\b)\s*/;

/** `a. m.`, `a.m.`, `A M` → `am`: one token the range separator cannot split. */
const MERIDIANO = /([ap])\.?\s*m\.?/gi;

/**
 * The `Turnos` sheet's `Horario` column — `8:00 a.m. - 2:00 p.m.`, `08:00-14:00`,
 * `7 p.m. a 10 p.m.`, `8:00 a. m. – 1:00 p. m.`.
 *
 * The label is kept verbatim because it is what the sheet chose to display and
 * what a volunteer will read; only `inicio` and `fin` are normalised to 24-hour
 * time, which is what sorting and comparing need. A row whose schedule cannot be
 * read is rejected rather than silently falling back to the default: a shift
 * running at a different hour than the sheet says is worse than a flagged row.
 */
export function horarioDesdeSheet(valor: string): Horario {
  const etiqueta = valor.trim();

  // The meridiem collapses first: stripping dots alone turns the `a. m.` that a
  // Spanish-locale sheet writes into a lone `a`, which is the range separator.
  const partes = etiqueta
    .replace(MERIDIANO, "$1m")
    .replace(/\./g, "")
    .split(SEPARADOR_HORARIO)
    .filter(Boolean);

  if (partes.length !== 2) {
    throw badRequest(
      `No entiendo el horario "${valor}". Usa "8:00 a.m. - 2:00 p.m." o "08:00-14:00".`,
    );
  }

  const [inicio = "", fin = ""] = partes;

  return { inicio: horaDesdeSheet(inicio, valor), fin: horaDesdeSheet(fin, valor), etiqueta };
}

/** `2:00 pm` → `14:00`. The meridiem is optional; without it the hour is 24-hour. */
function horaDesdeSheet(parte: string, horarioCompleto: string): string {
  const texto = parte.toLowerCase().replace(/\s+/g, "");
  const match = /^(\d{1,2})(?::(\d{2}))?(am|pm|m)?$/.exec(texto);

  if (!match) {
    throw badRequest(`No entiendo la hora "${parte}" del horario "${horarioCompleto}".`);
  }

  const [, crudaHora = "", minutos = "00", meridiano] = match;
  let hora = Number(crudaHora);

  if (meridiano === "pm" && hora < 12) hora += 12;
  if (meridiano === "am" && hora === 12) hora = 0;
  // `12 m.` is noon in Colombian usage, which 24-hour time already spells 12.
  if (hora > 23 || Number(minutos) > 59) {
    throw badRequest(`La hora "${parte}" del horario "${horarioCompleto}" no existe.`);
  }

  return `${String(hora).padStart(2, "0")}:${minutos}`;
}

/**
 * Back to the sheet verbatim, not as a pretty label.
 *
 * `ID_Turno` is matched literally on the other side — the board's own column
 * spells the slot `TARDE`, so answering `Tarde` would build an id no row has
 * and the `Reservados` write-back would land nowhere.
 */
export function jornadaHaciaSheet(jornada: Jornada): string {
  return normalizarJornada(jornada);
}

/**
 * `Punto Usaquén|2026-08-13|AM` → `punto-usaquen_2026-08-13_am`.
 *
 * The sheet keys shifts by the point's display name, so a renamed point
 * produces a different id on that side. Slugging both sides means the rename
 * still lands on the same Firestore document as long as the slug is stable.
 */
export function turnoIdDesdeSheet(valor: string): string {
  const partes = valor.split(SEPARADOR_ID_SHEET).map((parte) => parte.trim());

  if (partes.length !== 3) {
    throw badRequest(
      `El ID_Turno "${valor}" no tiene la forma "Punto de acopio|AAAA-MM-DD|Jornada".`,
    );
  }

  const [nombrePunto = "", fecha = "", jornada = ""] = partes;

  return buildTurnoId(slugify(nombrePunto), fechaDesdeSheet(fecha), jornadaDesdeSheet(jornada));
}

/** Builds the shift id from the separate columns, when ID_Turno comes empty. */
export function turnoIdDesdeColumnas(punto: string, fecha: string, jornada: string): string {
  return buildTurnoId(slugify(punto), fechaDesdeSheet(fecha), jornadaDesdeSheet(jornada));
}

/** `punto-usaquen_2026-08-13_am` → `Punto Usaquén|2026-08-13|AM`. */
export function turnoIdHaciaSheet(centroNombre: string, fecha: string, jornada: Jornada): string {
  return [centroNombre, fecha, jornadaHaciaSheet(jornada)].join(SEPARADOR_ID_SHEET);
}

const ESTADO_DESDE_SHEET: Record<string, EstadoReserva> = {
  reservado: "RESERVADO",
  confirmado: "CONFIRMADO",
  asistio: "ASISTIO",
  "no asistio": "NO_ASISTIO",
  cancelado: "CANCELADO",
};

export function estadoDesdeSheet(valor: string): EstadoReserva {
  const estado = ESTADO_DESDE_SHEET[normalizar(valor).toLowerCase()];

  if (!estado) {
    throw badRequest(
      `El estado "${valor}" no es válido. Usa ${Object.keys(ESTADO_DESDE_SHEET).join(", ")}.`,
    );
  }

  return estado;
}

const ESTADO_HACIA_SHEET: Record<EstadoReserva, string> = {
  RESERVADO: "Reservado",
  CONFIRMADO: "Confirmado",
  ASISTIO: "Asistió",
  NO_ASISTIO: "No asistió",
  CANCELADO: "Cancelado",
};

export function estadoHaciaSheet(estado: EstadoReserva): string {
  return ESTADO_HACIA_SHEET[estado];
}

/**
 * The board's `Asistencia` column, derived from the booking's state.
 *
 * Null while the shift has not been settled: an empty cell reads as "not marked
 * yet", where a `No` would claim the volunteer failed to show up. The column
 * replaced `Check-in`, `Check-out` and `Horas`, which the board dropped — those
 * still live in Firestore and in the admin export, where hours are counted.
 */
export function asistenciaHaciaSheet(estado: EstadoReserva): string {
  if (estado === "ASISTIO") return "Sí";
  if (estado === "NO_ASISTIO") return "No";
  return "";
}

/** The sheet's yes/no columns. Anything not recognisably "yes" is false. */
export function siNoDesdeSheet(valor: string | null | undefined): boolean {
  if (!valor) return false;
  return normalizar(valor).toLowerCase().startsWith("s");
}

export function siNoHaciaSheet(valor: boolean): string {
  return valor ? "Sí" : "No";
}

export type NombrePartido = { nombre: string; apellido: string };

/**
 * Splits the sheet's single `Nombre completo` column into the two fields the
 * API stores.
 *
 * There is no reliable way to do this — `Ana María Ramírez` could be one given
 * name and two surnames or two given names and one surname. The convention here
 * follows the common Colombian pattern: four or more words split two and two,
 * three words take the first as the given name. It is a guess, and the only
 * place in the sync that produces data the sheet did not state, so a
 * coordinator correcting it later must win over a re-sync.
 */
export function partirNombreCompleto(completo: string): NombrePartido {
  const palabras = completo.trim().split(/\s+/).filter(Boolean);

  if (palabras.length === 0) {
    throw badRequest("El nombre completo viene vacío.");
  }

  if (palabras.length === 1) {
    return { nombre: palabras[0] ?? "", apellido: "" };
  }

  const corte = palabras.length >= 4 ? 2 : 1;

  return {
    nombre: palabras.slice(0, corte).join(" "),
    apellido: palabras.slice(corte).join(" "),
  };
}

export function nombreCompletoHaciaSheet(nombre: string, apellido: string): string {
  return `${nombre} ${apellido}`.trim();
}

/** Strips accents so `Asistió` and `Asistio` are the same key. */
function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Every state the sheet may send, for schema validation messages. */
export const ESTADOS_SHEET = ESTADOS_RESERVA.map(estadoHaciaSheet);

/**
 * The `Donaciones` sheet's status dropdown, in the sheet's own words rather
 * than the domain's screaming-snake ones. The sheet's own legend: "Rojo = se
 * necesita · Verde = no se necesita · Gris = no se recibe."
 */
/**
 * The board's `Estado del cupo`, when it states one.
 *
 * `true` opens the shift, `false` closes it whatever the capacity says, and
 * `null` means the cell decides nothing — which is most of them: the column is
 * a formula and it is not dragged to the bottom of the board, so 124 of 188
 * rows sit blank while holding perfectly good shifts. A blank cell with
 * capacity is an open shift; reading it as closed would retire all of them.
 *
 * `Sin cupos` is deliberately absent. It is derived from `Disponibles` reaching
 * zero, not a decision someone made, and honouring it would freeze a full shift
 * shut so a cancellation could never reopen it.
 */
const ESTADO_CUPO_DESDE_SHEET: Record<string, boolean> = {
  abierto: true,
  abierta: true,
  open: true,
  si: true,
  disponible: true,
  activo: true,
  cerrado: false,
  cerrada: false,
  closed: false,
  no: false,
  "no disponible": false,
  inactivo: false,
};

export function estadoCupoDesdeSheet(valor: string | null): boolean | null {
  if (!valor) return null;
  return ESTADO_CUPO_DESDE_SHEET[normalizar(valor).toLowerCase()] ?? null;
}

const ESTADO_NECESIDAD_DESDE_SHEET: Record<string, EstadoNecesidad> = {
  "se necesita": "SE_NECESITA",
  "no se necesita": "SUFICIENTE",
  "no se recibe": "NO_APLICA",
};

/** `null` for a value the dropdown does not use, rather than throwing: one bad
 *  cell should not take the rest of the sheet's edit down with it. */
export function estadoNecesidadDesdeSheet(valor: string): EstadoNecesidad | null {
  return ESTADO_NECESIDAD_DESDE_SHEET[normalizar(valor).toLowerCase()] ?? null;
}
