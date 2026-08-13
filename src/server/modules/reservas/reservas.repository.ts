import { createHash } from "node:crypto";

import { COLLECTIONS, getDb } from "@/server/db/firestore";
import { conflict, notFound } from "@/server/http/errors";
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
export async function crearReservaEnTransaccion(input: CrearReservaInput): Promise<ReservaCreada> {
  const db = getDb();
  const turnoRef = db.collection(COLLECTIONS.turnos).doc(input.turnoId);
  const inscritoRef = turnoRef.collection(COLLECTIONS.inscritos).doc(hashCelular(input.celular));
  const reservaRef = db.collection(COLLECTIONS.reservas).doc();

  // Read outside the transaction. This is a load shedder, not the source of
  // truth: a full shift rejects every later request, and letting each one open
  // a transaction just to lose makes them queue on the same document. The
  // authoritative checks are still inside the transaction below.
  const turnoPrevio = await turnoRef.get();
  if (!turnoPrevio.exists) {
    throw notFound("El turno no existe.");
  }

  const turnoLeido = turnoSchema.parse({
    centroActivo: true,
    id: turnoPrevio.id,
    ...turnoPrevio.data(),
  });

  if (turnoLeido.estado !== "ABIERTO") {
    throw conflict("El turno no está disponible para inscripción.");
  }

  if (turnoLeido.reservados >= turnoLeido.cuposTotales) {
    throw conflict("El turno ya no tiene cupos disponibles.");
  }

  return db.runTransaction(async (tx) => {
    // Every read must happen before any write inside a Firestore transaction.
    const [turnoSnap, inscritoSnap] = await Promise.all([tx.get(turnoRef), tx.get(inscritoRef)]);

    if (!turnoSnap.exists) {
      throw notFound("El turno no existe.");
    }

    const turno = turnoSchema.parse({ centroActivo: true, id: turnoSnap.id, ...turnoSnap.data() });

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
      apellido: input.apellido,
      celular: input.celular,
      edad: input.edad,
      autorizoDatos: input.autorizoDatos,
      estado: "RESERVADO",
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
