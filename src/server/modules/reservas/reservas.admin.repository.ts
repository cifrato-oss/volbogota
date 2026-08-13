import { COLLECTIONS, getDb } from "@/server/db/firestore";
import { conflict, notFound } from "@/server/http/errors";

import { hashCelular } from "./reservas.repository";
import { puedeTransicionar } from "./reservas.admin.schema";
import { reservaSchema, type EstadoReserva, type Reserva } from "./reservas.schema";
import type { ListarReservasInput } from "./reservas.admin.schema";

function parseReserva(doc: FirebaseFirestore.DocumentSnapshot): Reserva {
  return reservaSchema.parse({ id: doc.id, ...doc.data() });
}

export async function buscarReservaPorCodigo(codigo: string): Promise<Reserva | null> {
  // The code is the document id, so this is a direct lookup — no query, no index.
  const doc = await getDb().collection(COLLECTIONS.reservas).doc(codigo).get();
  return doc.exists ? parseReserva(doc) : null;
}

export type PaginaReservas = {
  reservas: Reserva[];
  /** Pass back as `desde` to get the next page. Null when the list is exhausted. */
  siguiente: string | null;
};

export async function listarReservas(filtros: ListarReservasInput): Promise<PaginaReservas> {
  const db = getDb();
  let query = db.collection(COLLECTIONS.reservas) as FirebaseFirestore.Query;

  // Equality filters only, and a single orderBy on the cursor field. Every
  // filtered variant needs its own composite index — an automatic single-field
  // index only serves a query that filters and sorts on the same field, and here
  // the sort is always `creadoEn`. They are declared in `firestore.indexes.json`
  // and published by `pnpm run firebase:rules`; without that, a filtered request
  // fails with FAILED_PRECONDITION. A combination nobody declared fails the same
  // way, and the error carries a console link that creates the exact index.
  if (filtros.turno) query = query.where("turnoId", "==", filtros.turno);
  if (filtros.centro) query = query.where("centroId", "==", filtros.centro);
  if (filtros.fecha) query = query.where("fecha", "==", filtros.fecha);
  if (filtros.jornada) query = query.where("jornada", "==", filtros.jornada);
  if (filtros.estado) query = query.where("estado", "==", filtros.estado);

  query = query.orderBy("creadoEn", "desc");
  if (filtros.desde) query = query.startAfter(filtros.desde);

  // One extra document tells us whether another page exists without a count.
  const snapshot = await query.limit(filtros.limite + 1).get();
  const docs = snapshot.docs.slice(0, filtros.limite);
  const hayMas = snapshot.docs.length > filtros.limite;

  let reservas = docs.map(parseReserva);

  // Free-text search happens here rather than in the query: Firestore has no
  // substring matching, and the alternative — a search service — is not worth
  // standing up for a four-day event with a few thousand rows.
  if (filtros.q) {
    const termino = normalizar(filtros.q);
    reservas = reservas.filter((reserva) =>
      normalizar(`${reserva.nombre} ${reserva.apellido} ${reserva.celular}`).includes(termino),
    );
  }

  const ultima = docs.at(-1);

  return {
    reservas,
    siguiente: hayMas && ultima ? parseReserva(ultima).creadoEn : null,
  };
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Moves a reservation between states, releasing the seat when it is cancelled.
 *
 * The spreadsheet is explicit that `Cancelado` frees the slot, so this is the
 * mirror image of booking and runs in the same transaction: the shift counter
 * goes down and the per-shift phone lock is removed, which lets that person
 * sign up again for the same shift. Doing the two writes outside a transaction
 * would leak seats every time one of them failed.
 */
export async function cambiarEstado(codigo: string, nuevo: EstadoReserva): Promise<Reserva> {
  const db = getDb();
  const reservaRef = db.collection(COLLECTIONS.reservas).doc(codigo);

  return db.runTransaction(async (tx) => {
    const reservaSnap = await tx.get(reservaRef);
    if (!reservaSnap.exists) {
      throw notFound("La reserva no existe.");
    }

    const reserva = parseReserva(reservaSnap);

    if (reserva.estado === nuevo) {
      // Idempotent on purpose: a coordinator tapping twice on a bad connection
      // should not get an error for an outcome that already holds.
      return reserva;
    }

    if (!puedeTransicionar(reserva.estado, nuevo)) {
      throw conflict(`No se puede pasar de ${reserva.estado} a ${nuevo}.`);
    }

    const turnoRef = db.collection(COLLECTIONS.turnos).doc(reserva.turnoId);
    const turnoSnap = await tx.get(turnoRef);

    if (nuevo === "CANCELADO" && turnoSnap.exists) {
      const reservados = Number(turnoSnap.data()?.reservados) || 0;
      tx.update(turnoRef, { reservados: Math.max(0, reservados - 1) });
      tx.delete(turnoRef.collection(COLLECTIONS.inscritos).doc(hashCelular(reserva.celular)));
    }

    const actualizada: Reserva = { ...reserva, estado: nuevo };
    tx.update(reservaRef, { estado: nuevo });

    return actualizada;
  });
}

/**
 * Records arrival or departure at the gate.
 *
 * Hours are computed from the pair, and only when both exist. They feed the
 * volunteering certificates, so a check-out before the check-in is refused
 * rather than stored as a negative.
 */
export async function registrarHora(
  codigo: string,
  campo: "checkIn" | "checkOut",
  hora: string,
): Promise<Reserva> {
  const db = getDb();
  const reservaRef = db.collection(COLLECTIONS.reservas).doc(codigo);

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(reservaRef);
    if (!snapshot.exists) {
      throw notFound("La reserva no existe.");
    }

    const reserva = parseReserva(snapshot);

    if (reserva.estado === "CANCELADO") {
      throw conflict("La reserva está cancelada.");
    }

    if (campo === "checkOut" && !reserva.checkIn) {
      throw conflict("Registra primero la hora de entrada.");
    }

    const checkIn = campo === "checkIn" ? hora : reserva.checkIn;
    const checkOut = campo === "checkOut" ? hora : reserva.checkOut;

    if (checkIn && checkOut && enMinutos(checkOut) <= enMinutos(checkIn)) {
      throw conflict("La hora de salida debe ser posterior a la de entrada.");
    }

    const horas =
      checkIn && checkOut
        ? Math.round(((enMinutos(checkOut) - enMinutos(checkIn)) / 60) * 100) / 100
        : null;

    // Showing up is what "asistió" means; the coordinator should not have to
    // record it twice.
    const estado = campo === "checkIn" && reserva.estado !== "ASISTIO" ? "ASISTIO" : reserva.estado;

    const actualizada: Reserva = { ...reserva, checkIn, checkOut, horas, estado };
    tx.update(reservaRef, { checkIn, checkOut, horas, estado });

    return actualizada;
  });
}

function enMinutos(hora: string): number {
  const [h = "0", m = "0"] = hora.split(":");
  return Number(h) * 60 + Number(m);
}
