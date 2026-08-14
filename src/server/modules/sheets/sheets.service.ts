import { badRequest, isAppError, unprocessable } from "@/server/http/errors";
import { logger } from "@/server/lib/logger";
import { findCentros } from "@/server/modules/catalogo/catalogo.repository";
import {
  ACTIVIDADES,
  horarioDeJornada,
  slugify,
  type Actividad,
  type Centro,
  type TurnoDeHoja,
} from "@/server/modules/catalogo/catalogo.schema";
import {
  sincronizarCentros,
  sincronizarTurnos,
  type SincronizacionCatalogo,
  type SincronizacionTurnos,
} from "@/server/modules/catalogo/catalogo.service";
import {
  eliminarElementosAusentes,
  guardarElementosEnLote,
  guardarNecesidadesEnLote,
} from "@/server/modules/donaciones/donaciones.repository";
import {
  buildElementoId,
  buildNecesidadId,
  categoriaDonacionSchema,
  type CategoriaDonacion,
  type ElementoDonacion,
  type Necesidad,
} from "@/server/modules/donaciones/donaciones.schema";
import { crearReservaSchema, type Reserva } from "@/server/modules/reservas/reservas.schema";
import {
  actualizarEstadoReserva,
  crearReserva,
  encontrarReserva,
  encontrarReservaDeCelular,
  registrarHoraReserva,
} from "@/server/modules/reservas/reservas.service";

import {
  estadoCupoDesdeSheet,
  estadoDesdeSheet,
  estadoHaciaSheet,
  estadoNecesidadDesdeSheet,
  fechaDesdeSheet,
  horarioDesdeSheet,
  jornadaDesdeSheet,
  partirNombreCompleto,
  siNoDesdeSheet,
  turnoIdDesdeColumnas,
  turnoIdDesdeSheet,
} from "./sheets.mapper";
import type {
  FilaCentro,
  FilaDonacionRechazada,
  FilaReserva,
  FilaTurno,
  FilaTurnoRechazada,
  ResultadoFila,
  SincronizarCentrosInput,
  SincronizarDonacionesInput,
  SincronizarReservasInput,
  SincronizarTurnosInput,
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

/** What a coordinator should read in the sheet when a row could not be applied. */
function mensajeDe(error: unknown): string {
  if (isAppError(error)) return error.message;
  return error instanceof Error ? error.message : "Error inesperado.";
}

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
    // One key per capacity column the sheet carries. Nominal and informative:
    // what makes a shift bookable is a row of the `Turnos` board.
    cuposPorJornada: {
      AM: fila.cuposAm,
      TARDE: fila.cuposTarde,
      PM: fila.cuposPm,
      MADRUGADA: fila.cuposMadrugada,
      NOCHE: fila.cuposNoche,
    },
    // An empty cell means the point is in operation: the column exists to
    // retire one, not to enable each.
    activo: siNoDesdeSheet(fila.activo ?? "Sí"),
    coordinador: null,
  };
}

/**
 * Applies a `Centros` edit: the points, and nothing else.
 *
 * The board used to travel in this same payload, because shifts were derived
 * from the product of centres, dates and slots and a centre-only rebuild would
 * flatten the per-day capacity `Turnos` had authorised. Now the board creates
 * its own shifts, so this sheet no longer has to carry it — which is what makes
 * a capacity edit here cheap instead of a full re-read of both sheets.
 */
export async function sincronizarCentrosDesdeSheet(
  input: SincronizarCentrosInput,
): Promise<SincronizacionCatalogo> {
  const centros = input.filas.filter(esFilaDePunto).map(aCentro);

  if (centros.length === 0) {
    throw badRequest("Ninguna fila del rango enviado es un punto de acopio.");
  }

  const resultado = await sincronizarCentros(centros);

  logger.info("Centros sincronizados desde la hoja", {
    centros: resultado.centros,
    turnosRefrescados: resultado.turnos,
    desactivados: resultado.desactivados,
  });

  return resultado;
}

// --- Turnos ---------------------------------------------------------------

function aTurnoDeHoja(fila: FilaTurno): TurnoDeHoja {
  const jornada = jornadaDesdeSheet(fila.jornada);
  const horario = fila.horario ? horarioDesdeSheet(fila.horario) : null;

  // A slot the programme invented — `MADRUGADA 2` — has no default hours, so
  // its row has to state them. Guessing would publish a time nobody authorised.
  if (!horarioDeJornada(jornada, horario)) {
    throw badRequest(`La jornada "${fila.jornada}" no tiene horario por defecto: llena Horario.`);
  }

  return {
    // The sheet names the point the way `Centros` writes it, and the slug is
    // what turns that into an id — the same route `Reservas` takes.
    centroId: slugify(fila.puntoDeAcopio),
    // The raw name travels too: only it can tell `Cruz Roja – Sede
    // Administrativa` from a point the catalogue genuinely does not have.
    puntoDeAcopio: fila.puntoDeAcopio,
    fecha: fechaDesdeSheet(fila.fecha),
    jornada,
    dia: fila.dia,
    horario,
    abierto: estadoCupoDesdeSheet(fila.estadoCupo),
    cuposTotales: fila.cuposTotales,
  };
}

/**
 * Reads the board, keeping each unreadable row aside instead of throwing.
 *
 * Same rule as the reservations sync: a typo in one date must not stop the other
 * eighty-three shifts from being updated, so a bad row becomes a verdict for its
 * own `Validación` cell.
 */
function leerTablero(filas: FilaTurno[]) {
  const turnos: TurnoDeHoja[] = [];
  const rechazadas: FilaTurnoRechazada[] = [];
  const filasDelCentro = new Map<string, number[]>();

  for (const fila of filas) {
    try {
      const turno = aTurnoDeHoja(fila);
      turnos.push(turno);
      filasDelCentro.set(turno.centroId, [
        ...(filasDelCentro.get(turno.centroId) ?? []),
        fila.fila,
      ]);
    } catch (error) {
      rechazadas.push({ fila: fila.fila, motivo: mensajeDe(error) });
    }
  }

  /** Turns the ids the catalogue did not know back into the rows that named them. */
  function conDesconocidos(centrosDesconocidos: string[]): FilaTurnoRechazada[] {
    const desconocidas = centrosDesconocidos.flatMap((centroId) =>
      (filasDelCentro.get(centroId) ?? []).map((fila) => ({
        fila,
        motivo: `El punto de acopio no está en la hoja Centros (${centroId}).`,
      })),
    );

    return [...rechazadas, ...desconocidas].sort((a, b) => a.fila - b.fila);
  }

  return { turnos, rechazadas, conDesconocidos };
}

/** Applies the `Turnos` board to Firestore, without touching the catalogue. */
export async function sincronizarTurnosDesdeSheet(
  input: SincronizarTurnosInput,
): Promise<SincronizacionTurnos & { rechazadas: FilaTurnoRechazada[] }> {
  const tablero = leerTablero(input.filas);

  if (tablero.turnos.length === 0) {
    throw badRequest("Ninguna fila del tablero de turnos se pudo leer.");
  }

  const resultado = await sincronizarTurnos(tablero.turnos);
  const rechazadas = tablero.conDesconocidos(resultado.centrosDesconocidos);

  logger.info("Turnos sincronizados desde la hoja", {
    filas: input.filas.length,
    turnos: resultado.turnos,
    rechazadas: rechazadas.length,
  });

  return { ...resultado, rechazadas };
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
  const parsed = crearReservaSchema.safeParse({
    nombre,
    apellido,
    celular: fila.celular,
    edad: fila.edad,
    turnoId: turnoIdDe(fila),
    autorizoDatos: siNoDesdeSheet(fila.autorizoDatos),
    nombreEmergencia: fila.contactoEmergencia,
    contactoEmergencia: fila.celEmergencia,
    eps: fila.eps,
  });

  // The messages, not the raw issue objects: this text lands in the sheet's
  // Validación cell, where a coordinator reads it.
  if (!parsed.success) {
    throw unprocessable(parsed.error.issues.map((issue) => issue.message).join(" "));
  }

  const input = parsed.data;

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
    const validacion = mensajeDe(error);

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

// --- Donaciones -------------------------------------------------------------

/**
 * Applies a `Donaciones` edit: the catalogue of items and one status cell per
 * centre × item pair.
 *
 * Unlike `Centros`, this sheet owns the catalogue too — there is no separate
 * `Catálogo` tab, only `Categoría`/`Elemento` columns on the same rows that
 * carry each point's status — so every sync derives both from the one payload.
 * `orden` follows the row order the sheet already presents, restarting per
 * category. A cell naming an unknown point, or holding a word the dropdown
 * does not use, is reported back and skipped, the same way a bad `Turnos` row
 * is, instead of being treated as a reason to reject cells typed correctly.
 */
export async function sincronizarDonacionesDesdeSheet(input: SincronizarDonacionesInput): Promise<{
  elementos: number;
  necesidades: number;
  eliminados: string[];
  rechazadas: FilaDonacionRechazada[];
}> {
  const centros = await findCentros(false);
  const nombrePorCentroId = new Map(centros.map((centro) => [centro.id, centro.nombre]));

  const elementos = new Map<string, ElementoDonacion>();
  const ordenPorCategoria = new Map<CategoriaDonacion, number>();
  const necesidades: Necesidad[] = [];
  const rechazadas: FilaDonacionRechazada[] = [];
  const ahora = new Date().toISOString();

  for (const fila of input.filas) {
    const categoriaParsed = categoriaDonacionSchema.safeParse(fila.categoria);
    if (!categoriaParsed.success) {
      rechazadas.push({
        fila: fila.fila,
        motivo: `La categoría "${fila.categoria}" no es válida.`,
      });
      continue;
    }

    const categoria = categoriaParsed.data;
    const elementoId = buildElementoId(categoria, fila.elemento);

    if (!elementos.has(elementoId)) {
      const orden = ordenPorCategoria.get(categoria) ?? 0;
      ordenPorCategoria.set(categoria, orden + 1);
      elementos.set(elementoId, {
        id: elementoId,
        categoria,
        orden,
        nombre: fila.elemento,
        mensaje: null,
      });
    }

    for (const [nombreCentro, textoEstado] of Object.entries(fila.estados)) {
      // A blank cell means the pair has not been touched, not "not needed" —
      // leaving it alone is what lets a coordinator clear a cell back to the
      // service's own default instead of writing over it with nothing.
      if (!textoEstado) continue;

      const centroId = slugify(nombreCentro);
      const centroNombre = nombrePorCentroId.get(centroId);

      if (!centroNombre) {
        rechazadas.push({
          fila: fila.fila,
          motivo: `El punto de acopio "${nombreCentro}" no está en la hoja Centros.`,
        });
        continue;
      }

      const estado = estadoNecesidadDesdeSheet(textoEstado);
      if (!estado) {
        rechazadas.push({
          fila: fila.fila,
          motivo: `El estado "${textoEstado}" no es válido para "${nombreCentro}".`,
        });
        continue;
      }

      necesidades.push({
        id: buildNecesidadId(centroId, elementoId),
        centroId,
        centroNombre,
        elementoId,
        categoria,
        elemento: fila.elemento,
        estado,
        actualizadoEn: ahora,
      });
    }
  }

  if (elementos.size === 0) {
    throw badRequest("Ninguna fila del rango enviado se pudo leer.");
  }

  await Promise.all([
    guardarElementosEnLote([...elementos.values()]),
    necesidades.length > 0 ? guardarNecesidadesEnLote(necesidades) : Promise.resolve(),
  ]);

  // After the catalogue reflects the current sheet, anything else stored
  // under a different id is what the sheet stopped naming.
  const eliminados = await eliminarElementosAusentes([...elementos.keys()]);

  logger.info("Donaciones sincronizadas desde la hoja", {
    elementos: elementos.size,
    necesidades: necesidades.length,
    eliminados: eliminados.length,
    rechazadas: rechazadas.length,
  });

  return { elementos: elementos.size, necesidades: necesidades.length, eliminados, rechazadas };
}
