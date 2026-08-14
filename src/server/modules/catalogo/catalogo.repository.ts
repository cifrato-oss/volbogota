import { COLLECTIONS, getDb } from "@/server/db/firestore";
import { parseValidos } from "@/server/db/parse-validos";

import {
  centroSchema,
  turnoSchema,
  type Centro,
  type Jornada,
  type Turno,
} from "./catalogo.schema";

/**
 * Firestore reads for the catalogue. Documents are parsed on the way out so a
 * malformed import surfaces here instead of halfway through a request.
 */

export type TurnoFilters = {
  centroId?: string;
  fecha?: string;
  jornada?: Jornada;
};

export async function findCentros(soloActivos = true): Promise<Centro[]> {
  const db = getDb();
  let query = db.collection(COLLECTIONS.centros) as FirebaseFirestore.Query;

  if (soloActivos) {
    query = query.where("activo", "==", true);
  }

  const snapshot = await query.get();

  // Sorted in memory on purpose. Combining `where("activo")` with
  // `orderBy("nombre")` would oblige Firestore to have a composite index, and
  // the emulator does not enforce that — the query passes locally and fails on
  // the first real request. There are six points; the sort is free.
  return parseValidos(COLLECTIONS.centros, snapshot.docs, centroSchema).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es"),
  );
}

export async function findCentroById(id: string): Promise<Centro | null> {
  const doc = await getDb().collection(COLLECTIONS.centros).doc(id).get();
  if (!doc.exists) return null;

  return centroSchema.parse({ id: doc.id, ...doc.data() });
}

export async function findTurnos(filters: TurnoFilters = {}): Promise<Turno[]> {
  const db = getDb();
  let query = db.collection(COLLECTIONS.turnos) as FirebaseFirestore.Query;

  if (filters.centroId) query = query.where("centroId", "==", filters.centroId);
  if (filters.fecha) query = query.where("fecha", "==", filters.fecha);
  if (filters.jornada) query = query.where("jornada", "==", filters.jornada);

  const snapshot = await query.get();
  const turnos = parseValidos(COLLECTIONS.turnos, snapshot.docs, turnoSchema, {
    centroActivo: true,
  })
    // Shifts of retired points stay in Firestore for history but never surface:
    // listing them would advertise a point the city no longer authorises, and
    // counting them would inflate the published capacity.
    .filter((turno) => turno.centroActivo);

  // Sorted in memory: ordering by three fields in Firestore would need a
  // composite index per filter combination, and 84 shifts fit comfortably here.
  return turnos.sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      a.centroNombre.localeCompare(b.centroNombre) ||
      a.horario.inicio.localeCompare(b.horario.inicio) ||
      a.jornada.localeCompare(b.jornada, "es"),
  );
}

export async function findTurnoById(id: string): Promise<Turno | null> {
  const doc = await getDb().collection(COLLECTIONS.turnos).doc(id).get();
  if (!doc.exists) return null;

  // A shift left over from an older catalogue — a `NOCHE` one — is a shift that
  // no longer exists: 404 like any unknown id, not a 500 nobody can act on.
  const [turno] = parseValidos(COLLECTIONS.turnos, [doc], turnoSchema, { centroActivo: true });

  return turno ?? null;
}

export type CatalogoGuardado = { centros: number; turnos: number };

/**
 * Writes the points, and nothing else.
 *
 * Split from the shifts on purpose: the `Centros` sheet is informative — it
 * describes where a point is and what it nominally holds — while the `Turnos`
 * board is what creates a bookable shift. Keeping the two writes apart is what
 * lets one sheet be edited without the other's numbers moving.
 */
export async function guardarCentros(centros: Centro[]): Promise<number> {
  if (centros.length === 0) return 0;

  const db = getDb();
  const batch = db.batch();

  for (const centro of centros) {
    const { id, ...data } = centro;
    batch.set(db.collection(COLLECTIONS.centros).doc(id), data, { merge: true });
  }

  await batch.commit();

  return centros.length;
}

/**
 * Writes the shifts, carrying live booking counters over.
 *
 * `reservados` belongs to the booking transaction, never to the spreadsheet:
 * re-reading it and writing it back is what keeps a capacity edit from wiping
 * bookings already taken.
 */
export async function guardarTurnos(turnos: Turno[]): Promise<number> {
  if (turnos.length === 0) return 0;

  const db = getDb();

  const existentes = await db.collection(COLLECTIONS.turnos).get();
  const reservadosPrevios = new Map(
    existentes.docs.map((doc) => [doc.id, Number(doc.data().reservados) || 0]),
  );

  const batch = db.batch();

  for (const turno of turnos) {
    const { id, ...data } = turno;
    batch.set(
      db.collection(COLLECTIONS.turnos).doc(id),
      { ...data, reservados: reservadosPrevios.get(id) ?? 0 },
      { merge: true },
    );
  }

  await batch.commit();

  return turnos.length;
}

/**
 * Re-stamps on each shift the centre fields it carries a copy of.
 *
 * Those copies exist so listing shifts costs no centre lookup, which means a
 * `Centros` edit has to reach them — renaming a point or retiring it would
 * otherwise stay invisible on the board until someone touched `Turnos`.
 * Capacity is deliberately not among them: that is the board's to state.
 */
export async function refrescarCentroEnTurnos(centros: Centro[]): Promise<number> {
  if (centros.length === 0) return 0;

  const db = getDb();
  const porId = new Map(centros.map((centro) => [centro.id, centro]));
  const snapshot = await db.collection(COLLECTIONS.turnos).get();

  const batch = db.batch();
  let tocados = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const centro = porId.get(String(data.centroId ?? ""));
    if (!centro) continue;

    const cuposTotales = Number(data.cuposTotales) || 0;

    batch.update(db.collection(COLLECTIONS.turnos).doc(doc.id), {
      centroNombre: centro.nombre,
      centroActivo: centro.activo,
      horarioOficialCentro: centro.horarioOficial,
      coordinador: centro.coordinador,
      estado: centro.activo && cuposTotales > 0 ? "ABIERTO" : "CERRADO",
    });
    tocados += 1;
  }

  if (tocados > 0) await batch.commit();

  return tocados;
}

/**
 * Closes shifts the board no longer lists.
 *
 * Apps Script sends the whole `Turnos` sheet on every edit, so a shift missing
 * from the payload is one a coordinator deleted. It is closed rather than
 * deleted because a reservation may still point at it — the same reasoning
 * `desactivarCentrosAusentes` applies to a retired point.
 */
export async function cerrarTurnosAusentes(idsVigentes: string[]): Promise<string[]> {
  const db = getDb();
  const vigentes = new Set(idsVigentes);
  const snapshot = await db.collection(COLLECTIONS.turnos).get();

  const ausentes = snapshot.docs.filter(
    (doc) => !vigentes.has(doc.id) && doc.data().estado !== "CERRADO",
  );

  if (ausentes.length === 0) return [];

  const batch = db.batch();

  for (const doc of ausentes) {
    batch.update(db.collection(COLLECTIONS.turnos).doc(doc.id), {
      estado: "CERRADO",
      cuposTotales: 0,
    });
  }

  await batch.commit();

  return ausentes.map((doc) => doc.id);
}

/**
 * Retires points that no longer appear in the sheet.
 *
 * They are deactivated rather than deleted: a reservation still references its
 * shift, and deleting the centre would leave that history dangling. `findTurnos`
 * already drops shifts of inactive points from every public listing.
 */
export async function desactivarCentrosAusentes(idsVigentes: string[]): Promise<string[]> {
  const db = getDb();
  const vigentes = new Set(idsVigentes);
  const todos = await findCentros(false);
  const ausentes = todos.filter((centro) => centro.activo && !vigentes.has(centro.id));

  if (ausentes.length === 0) return [];

  const batch = db.batch();

  for (const centro of ausentes) {
    batch.update(db.collection(COLLECTIONS.centros).doc(centro.id), { activo: false });

    for (const turno of await findTurnos({ centroId: centro.id })) {
      batch.update(db.collection(COLLECTIONS.turnos).doc(turno.id), {
        centroActivo: false,
        estado: "CERRADO",
      });
    }
  }

  await batch.commit();

  return ausentes.map((centro) => centro.id);
}
