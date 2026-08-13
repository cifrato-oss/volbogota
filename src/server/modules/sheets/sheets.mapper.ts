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
  JORNADAS,
  buildTurnoId,
  slugify,
  type Jornada,
} from "@/server/modules/catalogo/catalogo.schema";
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
 * The evening shift no longer exists, but the sheet's dropdown and its older
 * `Turnos` rows still offer `Noche`. Such a row is rejected here with its own
 * verdict for the `Validación` column instead of being quietly booked into a
 * shift the programme no longer runs.
 */
export function jornadaDesdeSheet(valor: string): Jornada {
  const normalizada = normalizar(valor).toUpperCase();
  const jornada = JORNADAS.find((candidata) => candidata === normalizada);

  if (!jornada) {
    throw badRequest(`La jornada "${valor}" no es válida. Usa AM o PM.`);
  }

  return jornada;
}

const ETIQUETA_JORNADA_SHEET: Record<Jornada, string> = {
  AM: "AM",
  PM: "PM",
};

export function jornadaHaciaSheet(jornada: Jornada): string {
  return ETIQUETA_JORNADA_SHEET[jornada];
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
