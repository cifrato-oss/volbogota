import { createHash } from "node:crypto";

import { COLLECTIONS, getDb } from "@/server/db/firestore";
import { conflict, notFound, unprocessable } from "@/server/http/errors";
import { turnoSchema, type Turno } from "@/server/modules/catalogo/catalogo.schema";

import type { CrearReservaInput, Reserva } from "./reservas.schema";

/**
 * The phone number is the uniqueness key per shift, but storing it as a
 * document id would put personal data in a path that shows up in logs and
 * console URLs. A digest keeps the atomic guarantee without that exposure.
 */
function hashCelular(celular: string): string {
  return createHash("sha256").update(celular).digest("hex").slice(0, 32);
}

/** Human-facing code. The canonical identifier is still the document id. */
function buildCodigo(docId: string): string {
  return `VB-${docId.slice(0, 6).toUpperCase()}`;
}

export type ReservaCreada = { reserva: Reserva; turno: Turno };

/**
 * Books a slot atomically.
 *
 * Capacity lives in a counter on the shift document rather than being derived
 * by counting reservations: counting races (two requests can both read "one
 * seat left" and both succeed) and costs a read per existing booking. Inside a
 * transaction, Firestore aborts and retries whichever request lost the race, so
 * the counter can never oversell.
 *
 * Firestore sustains roughly one write per second on a single document. That is
 * per shift here, and there are 84 of them, so ordinary traffic spreads out. If
 * one popular shift ever becomes a hotspot, the fix is to shard this counter
 * across N documents and sum them on read — the call sites do not change.
 */
export async function crearReservaEnTransaccion(
  input: CrearReservaInput,
  actividadesPorCentro: (centroId: string) => Promise<string[]>,
): Promise<ReservaCreada> {
  const db = getDb();
  const turnoRef = db.collection(COLLECTIONS.turnos).doc(input.turnoId);
  const inscritoRef = turnoRef.collection(COLLECTIONS.inscritos).doc(hashCelular(input.celular));
  const reservaRef = db.collection(COLLECTIONS.reservas).doc();

  // Fetched before the transaction: it depends only on the centre catalogue,
  // which the import owns, so keeping it out avoids locking that document on
  // every single booking.
  const turnoPrevio = await turnoRef.get();
  if (!turnoPrevio.exists) {
    throw notFound("El turno no existe.");
  }
  const actividades = await actividadesPorCentro(
    turnoSchema.parse({ id: turnoPrevio.id, ...turnoPrevio.data() }).centroId,
  );

  if (!actividades.includes(input.actividad)) {
    throw unprocessable("La actividad no está habilitada en este centro.", [
      { field: "actividad", message: `Opciones válidas: ${actividades.join(", ")}.` },
    ]);
  }

  return db.runTransaction(async (tx) => {
    // Every read must happen before any write inside a Firestore transaction.
    const [turnoSnap, inscritoSnap] = await Promise.all([tx.get(turnoRef), tx.get(inscritoRef)]);

    if (!turnoSnap.exists) {
      throw notFound("El turno no existe.");
    }

    const turno = turnoSchema.parse({ id: turnoSnap.id, ...turnoSnap.data() });

    if (turno.estado !== "ABIERTO") {
      throw conflict("El turno está cerrado.");
    }

    if (inscritoSnap.exists) {
      throw conflict("Ya hay una inscripción con este celular en este turno.");
    }

    if (turno.reservados >= turno.cuposTotales) {
      throw conflict("El turno ya no tiene cupos disponibles.");
    }

    const creadoEn = new Date().toISOString();
    const reserva: Reserva = {
      id: reservaRef.id,
      codigo: buildCodigo(reservaRef.id),
      turnoId: turno.id,
      centroId: turno.centroId,
      centroNombre: turno.centroNombre,
      fecha: turno.fecha,
      jornada: turno.jornada,
      nombre: input.nombre,
      celular: input.celular,
      actividad: input.actividad,
      autorizoDatos: input.autorizoDatos,
      mayorDeEdad: input.mayorDeEdad,
      estado: "RESERVADO",
      contactoEmergencia: input.contactoEmergencia ?? null,
      eps: input.eps ?? null,
      notas: input.notas ?? null,
      creadoEn,
      checkIn: null,
      checkOut: null,
      horas: null,
    };

    tx.set(inscritoRef, { reservaId: reservaRef.id, creadoEn });
    tx.update(turnoRef, { reservados: turno.reservados + 1 });
    tx.set(reservaRef, reserva);

    return { reserva, turno: { ...turno, reservados: turno.reservados + 1 } };
  });
}
