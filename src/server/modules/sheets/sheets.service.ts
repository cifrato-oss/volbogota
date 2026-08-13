import { badRequest, isAppError } from "@/server/http/errors";
import { logger } from "@/server/lib/logger";
import {
  ACTIVIDADES,
  slugify,
  type Actividad,
  type Centro,
} from "@/server/modules/catalogo/catalogo.schema";
import {
  sincronizarCatalogo,
  type SincronizacionCatalogo,
} from "@/server/modules/catalogo/catalogo.service";
import { crearReservaSchema, type Reserva } from "@/server/modules/reservas/reservas.schema";
import {
  actualizarEstadoReserva,
  crearReserva,
  encontrarReserva,
  encontrarReservaDeCelular,
  registrarHoraReserva,
} from "@/server/modules/reservas/reservas.service";

import {
  estadoDesdeSheet,
  estadoHaciaSheet,
  partirNombreCompleto,
  siNoDesdeSheet,
  turnoIdDesdeColumnas,
  turnoIdDesdeSheet,
} from "./sheets.mapper";
import type {
  FilaCentro,
  FilaReserva,
  ResultadoFila,
  SincronizarCentrosInput,
  SincronizarReservasInput,
} from "./sheets.schema";

/**
 * Applies spreadsheet edits to Firestore.
 *
 * The sheet and the app are two control surfaces over one operation, so this
 * is the door through which the sheet's side reaches the data. Two rules shape
 * everything here:
 *
 * - The sheet owns the catalogue; the booking transaction owns `reservados`.
 * - A bad row is an answer, not a crash. Each row is reported back with its own
 *   verdict so a coordinator sees which one failed and why, in the sheet's own
 *   `Validación` column, instead of losing a whole batch to one typo.
 */

// --- Centros --------------------------------------------------------------

/** Rows below the table that are notes, not points. */
const PIE_DE_TABLA = /^(nota|supuesto|un cupo)/i;

function esFilaDePunto(fila: FilaCentro): boolean {
  const nombre = fila.puntoDeAcopio.trim();
  if (nombre.toUpperCase() === "TOTAL") return false;
  return !PIE_DE_TABLA.test(nombre);
}

/**
 * The sheet's activities cell is free text. Unknown values are dropped rather
 * than rejected: a coordinator adding "Logística" should not break the sync of
 * six points, and the closed set is what the rest of the domain relies on.
 */
function parsearActividades(valor: string | null): Actividad[] {
  if (!valor) return [];

  const permitidas = new Set<string>(ACTIVIDADES);

  return valor
    .split(",")
    .map((actividad) => actividad.trim())
    .filter((actividad): actividad is Actividad => permitidas.has(actividad));
}

function aCentro(fila: FilaCentro): Centro {
  return {
    id: slugify(fila.puntoDeAcopio),
    nombre: fila.puntoDeAcopio,
    direccion: fila.direccion,
    localidad: fila.localidad,
    linkMaps: fila.linkMaps,
    horarioOficial: fila.horarioOficial,
    observaciones: fila.observaciones,
    actividades: parsearActividades(fila.actividades),
    cuposPorJornada: {
      AM: fila.cuposAm,
      PM: fila.cuposPm,
      NOCHE: fila.cuposNoche,
    },
    // An empty cell means the point is in operation: the column exists to
    // retire one, not to enable each.
    activo: siNoDesdeSheet(fila.activo ?? "Sí"),
    coordinador: null,
  };
}

export async function sincronizarCentrosDesdeSheet(
  input: SincronizarCentrosInput,
): Promise<SincronizacionCatalogo> {
  const centros = input.filas.filter(esFilaDePunto).map(aCentro);

  if (centros.length === 0) {
    throw badRequest("Ninguna fila del rango enviado es un punto de acopio.");
  }

  const resultado = await sincronizarCatalogo(centros, input.fechas);

  logger.info("Catálogo sincronizado desde la hoja", {
    centros: resultado.centros,
    turnos: resultado.turnos,
    desactivados: resultado.desactivados,
  });

  return resultado;
}

// --- Reservas -------------------------------------------------------------

/** Codes we issued. Anything else in the column is the sheet's own numbering. */
const CODIGO_PROPIO = /^VB-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/;

function turnoIdDe(fila: FilaReserva): string {
  if (fila.idTurno) return turnoIdDesdeSheet(fila.idTurno);

  if (fila.puntoDeAcopio && fila.fechaJornada && fila.jornada) {
    return turnoIdDesdeColumnas(fila.puntoDeAcopio, fila.fechaJornada, fila.jornada);
  }

  throw badRequest("Falta el ID_Turno y no hay punto, fecha y jornada para deducirlo.");
}

/**
 * Applies the row's state and times to a reservation that already exists.
 *
 * State goes first on purpose: a check-in marks `ASISTIO`, and applying the
 * sheet's `Confirmado` afterwards would be an illegal transition out of it.
 */
async function aplicarEstadoYHoras(reserva: Reserva, fila: FilaReserva): Promise<Reserva> {
  let actual = reserva;

  if (fila.estado) {
    const estado = estadoDesdeSheet(fila.estado);
    if (estado !== actual.estado) {
      actual = await actualizarEstadoReserva(actual.codigo, estado);
    }
  }

  if (fila.checkIn && fila.checkIn !== actual.checkIn) {
    actual = await registrarHoraReserva(actual.codigo, "checkIn", fila.checkIn);
  }

  if (fila.checkOut && fila.checkOut !== actual.checkOut) {
    actual = await registrarHoraReserva(actual.codigo, "checkOut", fila.checkOut);
  }

  return actual;
}

async function crearDesdeFila(fila: FilaReserva): Promise<ResultadoFila> {
  const { nombre, apellido } = partirNombreCompleto(fila.nombreCompleto);

  // Through the same schema the web form uses: the phone gets normalised, the
  // age coerced, and a missing consent rejected before anything is written.
  const input = crearReservaSchema.parse({
    nombre,
    apellido,
    celular: fila.celular,
    edad: fila.edad,
    turnoId: turnoIdDe(fila),
    autorizoDatos: siNoDesdeSheet(fila.autorizoDatos),
  });

  // The same transaction the web uses, so a hand-typed row cannot oversell a
  // shift or slip past the one-per-phone rule.
  const confirmacion = await crearReserva(input);

  const creada = await encontrarReserva(confirmacion.codigo);
  const final = creada ? await aplicarEstadoYHoras(creada, fila) : null;

  return {
    fila: fila.fila,
    validacion: "OK",
    codigo: confirmacion.codigo,
    estado: estadoHaciaSheet(final?.estado ?? "RESERVADO"),
    creada: true,
  };
}

async function actualizarDesdeFila(reserva: Reserva, fila: FilaReserva): Promise<ResultadoFila> {
  const actual = await aplicarEstadoYHoras(reserva, fila);

  return {
    fila: fila.fila,
    validacion: "OK",
    codigo: actual.codigo,
    estado: estadoHaciaSheet(actual.estado),
    creada: false,
  };
}

/**
 * Finds the booking a row refers to, by code or by who it is for.
 *
 * The code is the direct route, but a row can legitimately lack one: the sheet
 * keeps operating while Firestore is unavailable, so a row typed during an
 * outage arrives later with nothing written back yet. Falling back to the
 * shift's phone lock is what lets that re-sync land as an update instead of
 * bouncing off the one-per-shift rule forever.
 */
async function encontrarDeLaFila(fila: FilaReserva): Promise<Reserva | null> {
  if (fila.codigo && CODIGO_PROPIO.test(fila.codigo)) {
    const porCodigo = await encontrarReserva(fila.codigo);
    if (porCodigo) return porCodigo;
  }

  const celular = crearReservaSchema.shape.celular.safeParse(fila.celular);
  if (!celular.success) return null;

  return encontrarReservaDeCelular(turnoIdDe(fila), celular.data);
}

async function procesarFila(fila: FilaReserva): Promise<ResultadoFila> {
  try {
    const existente = await encontrarDeLaFila(fila);

    return existente ? await actualizarDesdeFila(existente, fila) : await crearDesdeFila(fila);
  } catch (error) {
    // One bad row must not take the batch down with it. The message goes back
    // to the sheet's Validación column, which is where a coordinator looks.
    const validacion = isAppError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : "Error inesperado.";

    logger.warn("Fila de reservas rechazada", { fila: fila.fila, validacion });

    return {
      fila: fila.fila,
      validacion,
      codigo: fila.codigo ?? null,
      estado: null,
      creada: false,
    };
  }
}

export async function sincronizarReservasDesdeSheet(
  input: SincronizarReservasInput,
): Promise<{ resultados: ResultadoFila[]; creadas: number; actualizadas: number }> {
  const resultados: ResultadoFila[] = [];

  // Sequential on purpose. Rows in one batch usually belong to the same shift,
  // and firing them together would make them contend for that shift's counter —
  // the exact pile-up the booking backoff exists to drain.
  for (const fila of input.filas) {
    resultados.push(await procesarFila(fila));
  }

  const creadas = resultados.filter((resultado) => resultado.creada).length;
  const actualizadas = resultados.filter(
    (resultado) => !resultado.creada && resultado.validacion === "OK",
  ).length;

  logger.info("Reservas sincronizadas desde la hoja", {
    filas: resultados.length,
    creadas,
    actualizadas,
  });

  return { resultados, creadas, actualizadas };
}
