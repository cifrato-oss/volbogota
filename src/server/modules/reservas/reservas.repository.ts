import { createHmac, randomBytes } from "node:crypto";
import { setTimeout } from "node:timers/promises";

import { env } from "@/server/config/env";
import { COLLECTIONS, getDb } from "@/server/db/firestore";
import { conflict, notFound, serviceUnavailable } from "@/server/http/errors";
import { turnoSchema, type Turno } from "@/server/modules/catalogo/catalogo.schema";

import type { CrearReservaInput, Reserva } from "./reservas.schema";

/**
 * Per-shift deduplication key for a phone number.
 *
 * The phone is what makes "one sign-up per person per shift" enforceable, but
 * using it as a document id would write personal data into a path that shows up
 * in the Firebase console, in exports and in any BigQuery mirror.
 *
 * A plain digest does not solve that. Colombian mobiles are ten digits with a
 * fixed leading 3, so the entire space is about 3e9 values — small enough to
 * precompute in seconds and reverse every hash. Keying the HMAC with a secret
 * is what actually makes it irreversible: without `CELULAR_HASH_SALT` there is
 * no dictionary to build.
 *
 * The secret cannot be rotated once real sign-ups exist — every stored digest
 * would stop matching and the per-shift deduplication would silently break.
 */
export function hashCelular(celular: string): string {
  return createHmac("sha256", env.celularHashSalt).update(celular).digest("hex").slice(0, 32);
}

/**
 * Alphabet for the volunteer-facing code: no `O`/`0`, no `I`/`1`/`L`, so a code
 * read over the phone or off a screen at a noisy collection point cannot be
 * transcribed into a different one.
 */
const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const LONGITUD_CODIGO = 8;

/**
 * Volunteer-facing code, and the reservation's document id.
 *
 * Deriving this from the Firestore auto-id was wrong: auto-ids are
 * case-sensitive base62, and upper-casing six of their characters collapsed the
 * space by more than an order of magnitude — and unevenly, since two letter
 * cases fold onto one. Across the event's expected volume, two volunteers
 * sharing a code was a real possibility, and the code is what check-in reads.
 *
 * Drawing from a uniform random source instead gives 31^8 (~8.5e11)
 * possibilities. Using it as the document id means Firestore itself enforces
 * uniqueness, so a collision surfaces as a rejected write rather than as two
 * reservations quietly answering to the same code.
 */
export function generarCodigo(): string {
  let codigo = "";

  while (codigo.length < LONGITUD_CODIGO) {
    // Rejection sampling: a plain modulo over 256 would favour the first
    // 256 % 31 = 8 symbols of the alphabet.
    const limite = 256 - (256 % ALFABETO_CODIGO.length);

    for (const byte of randomBytes(LONGITUD_CODIGO * 2)) {
      if (byte >= limite) continue;
      codigo += ALFABETO_CODIGO[byte % ALFABETO_CODIGO.length];
      if (codigo.length === LONGITUD_CODIGO) break;
    }
  }

  return `VB-${codigo}`;
}

/**
 * The reservation holding this shift's lock for that phone, if any.
 *
 * Exists so a re-sync can converge. The spreadsheet and the app are meant to
 * work independently — if Firestore is down when a row is typed, the sheet
 * carries on and syncs later — but a retry then hits the one-per-shift lock and
 * would report "already enrolled" forever, leaving that row without its code.
 * Reading the lock turns that dead end into an update of the booking that is
 * already there.
 */
export async function buscarReservaDeCelularEnTurno(
  turnoId: string,
  celular: string,
): Promise<string | null> {
  const doc = await getDb()
    .collection(COLLECTIONS.turnos)
    .doc(turnoId)
    .collection(COLLECTIONS.inscritos)
    .doc(hashCelular(celular))
    .get();

  if (!doc.exists) return null;

  const reservaId = doc.data()?.reservaId;
  return typeof reservaId === "string" && reservaId !== "" ? reservaId : null;
}

/** Enough attempts to drain a launch burst; the last ceiling is ~1.9 s. */
const MAX_INTENTOS_CONTENCION = 7;
const ESPERA_BASE_MS = 30;

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
 * per shift here, and there are 72 of them, so ordinary traffic spreads out. A
 * launch burst against a single shift is a different story and is not solved
 * here — see the backoff below, and the pending redesign toward one document
 * per seat.
 */
export async function crearReservaEnTransaccion(input: CrearReservaInput): Promise<ReservaCreada> {
  const db = getDb();
  const turnoRef = db.collection(COLLECTIONS.turnos).doc(input.turnoId);
  const inscritoRef = turnoRef.collection(COLLECTIONS.inscritos).doc(hashCelular(input.celular));
  // The code is the document id, so Firestore guarantees no two reservations
  // ever answer to the same one.
  const reservaRef = db.collection(COLLECTIONS.reservas).doc(generarCodigo());

  // Read outside the transaction. This is a load shedder, not the source of
  // truth: a full shift rejects every later request, and letting each one open
  // a transaction just to lose makes them all queue on the same document until
  // Firestore gives up with a lock timeout. The authoritative checks are still
  // inside the transaction below — this only spares the hopeless ones the trip.
  // A stale read here is harmless: the worst case is a request that proceeds and
  // gets rejected a few milliseconds later, which is the normal path.
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

  return ejecutarReserva();

  /**
   * Retries the transaction while it is only losing contention.
   *
   * Bookings for one shift all serialize on one document, so a launch burst has
   * far more callers than the document can absorb per second. Firestore's own
   * retries give up quickly and in lockstep, which leaves seats unassigned while
   * everyone receives an error. Backing off by an exponentially growing random
   * delay spreads the callers out in time so the queue actually drains.
   *
   * Only contention is retried. A full shift, a duplicate phone or a closed
   * shift are answers, not failures — they surface immediately.
   */
  async function ejecutarReserva(): Promise<ReservaCreada> {
    for (let intento = 0; intento < MAX_INTENTOS_CONTENCION; intento += 1) {
      try {
        return await reservar();
      } catch (error) {
        if (!esContencion(error)) throw error;

        // Full jitter. A fixed delay would just re-synchronise the callers we
        // are trying to separate.
        const techo = ESPERA_BASE_MS * 2 ** intento;
        await setTimeout(Math.random() * techo);
      }
    }

    // Still contended after backing off: the shift is genuinely saturated.
    // Say so, so the caller retries instead of reading it as a broken request.
    throw serviceUnavailable();
  }

  function reservar(): Promise<ReservaCreada> {
    return db.runTransaction(async (tx) => {
      // Every read must happen before any write inside a Firestore transaction.
      const [turnoSnap, inscritoSnap, reservaSnap] = await Promise.all([
        tx.get(turnoRef),
        tx.get(inscritoRef),
        tx.get(reservaRef),
      ]);

      if (!turnoSnap.exists) {
        throw notFound("El turno no existe.");
      }

      // Astronomically unlikely, but a silent duplicate here would hand two
      // volunteers the same code at check-in. Better a retryable failure.
      if (reservaSnap.exists) {
        throw conflict("No pudimos generar tu código de confirmación. Intenta de nuevo.");
      }

      const turno = turnoSchema.parse({
        centroActivo: true,
        id: turnoSnap.id,
        ...turnoSnap.data(),
      });

      if (turno.estado !== "ABIERTO") {
        throw conflict("El turno no está disponible para inscripción.");
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
        // Same value: the code is the id.
        codigo: reservaRef.id,
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
        nombreEmergencia: input.nombreEmergencia,
        contactoEmergencia: input.contactoEmergencia,
        eps: input.eps,
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
}

/**
 * Firestore signals lost contention with gRPC status 10 (ABORTED), after
 * exhausting its own retries. It is transient by definition.
 */
function esContencion(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;

  const codigo = (error as { code?: unknown }).code;
  const mensaje = (error as { message?: unknown }).message;

  return codigo === 10 || (typeof mensaje === "string" && mensaje.includes("ABORTED"));
}
