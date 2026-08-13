import { COLLECTIONS, getDb } from "@/server/db/firestore";

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
  return snapshot.docs
    .map((doc) => centroSchema.parse({ id: doc.id, ...doc.data() }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
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
  const turnos = snapshot.docs
    .map((doc) => turnoSchema.parse({ centroActivo: true, id: doc.id, ...doc.data() }))
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
      jornadaOrder(a.jornada) - jornadaOrder(b.jornada),
  );
}

export async function findTurnoById(id: string): Promise<Turno | null> {
  const doc = await getDb().collection(COLLECTIONS.turnos).doc(id).get();
  if (!doc.exists) return null;

  return turnoSchema.parse({ centroActivo: true, id: doc.id, ...doc.data() });
}

function jornadaOrder(jornada: Jornada): number {
  return { AM: 0, PM: 1, NOCHE: 2 }[jornada];
}

export type CatalogoGuardado = { centros: number; turnos: number };

/**
 * Writes the catalogue, carrying live booking counters over.
 *
 * `reservados` belongs to the booking transaction, never to the spreadsheet:
 * re-reading it and writing it back is what keeps a capacity edit from wiping
 * bookings already taken. Everything else on the shift is rebuilt from the
 * centre, because the sheet is the authority on the catalogue.
 */
export async function guardarCatalogo(
  centros: Centro[],
  turnos: Turno[],
): Promise<CatalogoGuardado> {
  const db = getDb();

  const existentes = await db.collection(COLLECTIONS.turnos).get();
  const reservadosPrevios = new Map(
    existentes.docs.map((doc) => [doc.id, Number(doc.data().reservados) || 0]),
  );

  const batch = db.batch();

  for (const centro of centros) {
    const { id, ...data } = centro;
    batch.set(db.collection(COLLECTIONS.centros).doc(id), data, { merge: true });
  }

  for (const turno of turnos) {
    const { id, ...data } = turno;
    batch.set(
      db.collection(COLLECTIONS.turnos).doc(id),
      { ...data, reservados: reservadosPrevios.get(id) ?? 0 },
      { merge: true },
    );
  }

  await batch.commit();

  return { centros: centros.length, turnos: turnos.length };
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
