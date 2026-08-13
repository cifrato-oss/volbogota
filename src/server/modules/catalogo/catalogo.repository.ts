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
  let query = db.collection(COLLECTIONS.centros).orderBy("nombre");

  if (soloActivos) {
    query = query.where("activo", "==", true);
  }

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => centroSchema.parse({ id: doc.id, ...doc.data() }));
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
