import { env } from "@/server/config/env";
import { badRequest } from "@/server/http/errors";
import { logger } from "@/server/lib/logger";
import { findTurnoById } from "@/server/modules/catalogo/catalogo.repository";
import type { Jornada, Turno } from "@/server/modules/catalogo/catalogo.schema";
import type { Reserva } from "@/server/modules/reservas/reservas.schema";

import {
  estadoHaciaSheet,
  fechaHaciaSheet,
  jornadaHaciaSheet,
  nombreCompletoHaciaSheet,
  siNoHaciaSheet,
  turnoIdHaciaSheet,
} from "./sheets.mapper";

/**
 * Pushes reservations back into the spreadsheet.
 *
 * The other direction of the sync. Without it a volunteer who signs up on the
 * web never appears in the sheet, and the coordinators at the door work off a
 * list that is missing people — the sheet is what they actually read.
 *
 * The target is an Apps Script web app (`doPost`) rather than the Sheets API:
 * the script already has permission to write its own spreadsheet, so this needs
 * no Google credentials on our side, which is the same reason the app can run
 * with `DB_DRIVER=memory`.
 *
 * A failure here is never allowed to reach the volunteer. Their booking is
 * already committed — the sheet is a copy, and a copy that lags is a nuisance,
 * while a booking that fails because Google was slow is a lost volunteer.
 */

/** Fields the sheet's `Reservas` columns need, named as that side names them. */
type FilaSaliente = {
  codigo: string;
  fechaRegistro: string;
  nombreCompleto: string;
  celular: string;
  edad: number;
  puntoDeAcopio: string;
  fechaJornada: string;
  jornada: string;
  idTurno: string;
  autorizoDatos: string;
  /** Sheet column R. */
  contactoEmergencia: string;
  /** Sheet column S. */
  celEmergencia: string;
  /** Sheet column T. */
  eps: string;
  estado: string;
  checkIn: string;
  checkOut: string;
  horas: string;
  validacion: string;
};

function aFilaSaliente(reserva: Reserva): FilaSaliente {
  return {
    codigo: reserva.codigo,
    fechaRegistro: fechaHoraHaciaSheet(reserva.creadoEn),
    nombreCompleto: nombreCompletoHaciaSheet(reserva.nombre, reserva.apellido),
    celular: reserva.celular,
    edad: reserva.edad,
    puntoDeAcopio: reserva.centroNombre,
    fechaJornada: fechaHaciaSheet(reserva.fecha),
    jornada: jornadaHaciaSheet(reserva.jornada as Jornada),
    idTurno: turnoIdHaciaSheet(reserva.centroNombre, reserva.fecha, reserva.jornada as Jornada),
    autorizoDatos: siNoHaciaSheet(reserva.autorizoDatos),
    contactoEmergencia: reserva.nombreEmergencia ?? "",
    celEmergencia: reserva.contactoEmergencia ?? "",
    eps: reserva.eps ?? "",
    estado: estadoHaciaSheet(reserva.estado),
    checkIn: reserva.checkIn ?? "",
    checkOut: reserva.checkOut ?? "",
    // Comma as the decimal separator: the sheet reads a Spanish locale, where a
    // dot would land as a thousands separator and turn 5,92 hours into 592.
    horas: reserva.horas === null ? "" : String(reserva.horas).replace(".", ","),
    validacion: "OK",
  };
}

/** `2026-08-13T14:05:00.000Z` → `13/08/2026 09:05` in Bogotá time. */
function fechaHoraHaciaSheet(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;

  const partes = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(fecha);

  const buscar = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? "";

  return `${buscar("day")}/${buscar("month")}/${buscar("year")} ${buscar("hour")}:${buscar("minute")}`;
}

export type ResultadoEmpuje = {
  enviadas: number;
  ok: boolean;
  /** Why it did not land, for the caller to log or show. Null when it did. */
  error: string | null;
};

/** Apps Script can be slow to wake; past this the booking should not keep waiting. */
const TIMEOUT_MS = 8000;

/** Todo fallo se registra: un push que no llega no puede ser invisible. */
function fallo(filas: number, error: string): ResultadoEmpuje {
  logger.warn("No se pudo empujar a la hoja", { filas, motivo: error });
  return { enviadas: 0, ok: false, error };
}

/**
 * Sends reservations to the sheet. Never throws.
 *
 * Callers are on the request path of a booking, so the contract is that this
 * reports failure instead of raising it. `POST /api/hooks/sheets/push` re-sends
 * whatever did not make it.
 */
export async function empujarReservasAlSheet(reservas: Reserva[]): Promise<ResultadoEmpuje> {
  return enviarAlSheet({ reservas: reservas.map(aFilaSaliente) }, reservas.length);
}

/**
 * Writes each shift's live `reservados` back into the `Turnos` sheet.
 *
 * Only that column travels: `Disponibles`, `% Ocupación` and `Estado del cupo`
 * are formulas over it, so the sheet recalculates them and there is no second
 * copy of the arithmetic to drift.
 */
export async function empujarTurnosAlSheet(turnos: Turno[]): Promise<ResultadoEmpuje> {
  const filas = turnos.map((turno) => ({
    idTurno: turnoIdHaciaSheet(turno.centroNombre, turno.fecha, turno.jornada),
    reservados: turno.reservados,
  }));

  return enviarAlSheet({ turnos: filas }, filas.length);
}

/** The one POST both directions share: same web app, same envelope, same failure contract. */
async function enviarAlSheet(
  carga: Record<string, unknown>,
  cantidad: number,
): Promise<ResultadoEmpuje> {
  if (cantidad === 0) return { enviadas: 0, ok: true, error: null };

  const url = env.sheetsWebhookUrl;
  const token = env.sheetsHookToken;

  if (!url || !token) {
    // Not an error: the deployment simply has no sheet wired up yet.
    return { enviadas: 0, ok: true, error: null };
  }

  const control = new AbortController();
  const timeout = setTimeout(() => control.abort(), TIMEOUT_MS);

  try {
    const respuesta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, ...carga }),
      signal: control.signal,
      // Apps Script answers the web-app URL with a redirect to a script.google
      // host, so following it is required to get the real response.
      redirect: "follow",
    });

    if (!respuesta.ok) {
      return fallo(cantidad, `La hoja respondió ${respuesta.status}.`);
    }

    /**
     * A 200 is not proof that anything was written.
     *
     * A web app deployed from a version without `doPost` still answers 200 —
     * with Google's own HTML — so trusting the status reports success for
     * rows that never reached a cell. Only the script's own envelope counts.
     */
    const texto = await respuesta.text();
    let confirmacion: { success?: boolean; error?: string };

    try {
      confirmacion = JSON.parse(texto) as { success?: boolean; error?: string };
    } catch {
      return fallo(
        cantidad,
        "La hoja respondió algo que no es JSON. Suele ser un doPost que revienta, " +
          "un despliegue en una versión vieja, o 'Quién tiene acceso' distinto de 'Cualquiera'.",
      );
    }

    if (!confirmacion.success) {
      return fallo(cantidad, confirmacion.error ?? "La hoja rechazó el envío.");
    }

    logger.info("Empujado a la hoja", { filas: cantidad });

    return { enviadas: cantidad, ok: true, error: null };
  } catch (error) {
    const motivo =
      error instanceof Error && error.name === "AbortError"
        ? `La hoja no respondió en ${TIMEOUT_MS} ms.`
        : error instanceof Error
          ? error.message
          : "Error inesperado.";

    return fallo(cantidad, motivo);
  } finally {
    // Left pending, the timer keeps the event loop alive well past the response.
    clearTimeout(timeout);
  }
}

/**
 * Fire-and-forget for the booking path.
 *
 * Awaited rather than left dangling: on a serverless runtime the process can be
 * frozen the moment the response is sent, which would drop the write silently.
 * The wait is bounded and the result is swallowed, so the volunteer sees their
 * code either way.
 */
export async function notificarReservaAlSheet(reserva: Reserva): Promise<void> {
  await empujarReservasAlSheet([reserva]);
}

/**
 * Same fire-and-forget contract, for the shift's capacity.
 *
 * The counter is read back from the store instead of taken from the caller: the
 * booking transaction owns `reservados`, so re-reading is what keeps the sheet
 * honest when two volunteers book the same shift at once.
 */
export async function notificarTurnoAlSheet(turnoId: string): Promise<void> {
  const turno = await findTurnoById(turnoId);
  if (turno) await empujarTurnosAlSheet([turno]);
}

/** Guards the push endpoint against a request with nothing to send. */
export function exigirReservas(reservas: Reserva[]): void {
  if (reservas.length === 0) {
    throw badRequest("No hay reservas para enviar a la hoja.");
  }
}
