import { COLLECTIONS, getDb } from "@/server/db/firestore";
import { parseValidos } from "@/server/db/parse-validos";

import {
  elementoDonacionSchema,
  necesidadSchema,
  type CategoriaDonacion,
  type ElementoDonacion,
  type Necesidad,
} from "./donaciones.schema";

/** Firestore reads for the donation catalogue and its per-centre need states. */

export async function findElementos(categoria?: CategoriaDonacion): Promise<ElementoDonacion[]> {
  const db = getDb();
  let query = db.collection(COLLECTIONS.catalogoDonaciones) as FirebaseFirestore.Query;

  if (categoria) query = query.where("categoria", "==", categoria);

  const snapshot = await query.get();

  // Sorted in memory, same reasoning as `findCentros`: combining `where` with
  // `orderBy` needs a composite index the emulator does not enforce, and 56
  // items is nothing to sort by hand.
  return parseValidos(COLLECTIONS.catalogoDonaciones, snapshot.docs, elementoDonacionSchema).sort(
    (a, b) => a.categoria.localeCompare(b.categoria, "es") || a.orden - b.orden,
  );
}

export async function findNecesidadesPorCentro(centroId: string): Promise<Necesidad[]> {
  const db = getDb();
  const snapshot = await db
    .collection(COLLECTIONS.necesidades)
    .where("centroId", "==", centroId)
    .get();

  return parseValidos(COLLECTIONS.necesidades, snapshot.docs, necesidadSchema);
}

/** Upserts a single need — what the admin panel changes in real time. */
export async function guardarNecesidad(necesidad: Necesidad): Promise<void> {
  const { id, ...data } = necesidad;
  await getDb().collection(COLLECTIONS.necesidades).doc(id).set(data, { merge: true });
}

/** Firestore's batch write cap is 500 — chunked so a full sheet sync stays under it. */
const LIMITE_LOTE = 400;

/** Upserts many needs at once — what the sheet sync applies on every edit. */
export async function guardarNecesidadesEnLote(necesidades: Necesidad[]): Promise<void> {
  const db = getDb();

  for (let inicio = 0; inicio < necesidades.length; inicio += LIMITE_LOTE) {
    const lote = db.batch();

    for (const necesidad of necesidades.slice(inicio, inicio + LIMITE_LOTE)) {
      const { id, ...data } = necesidad;
      lote.set(db.collection(COLLECTIONS.necesidades).doc(id), data, { merge: true });
    }

    await lote.commit();
  }
}

/** Whether the sheet (or the admin panel) has ever written a need, anywhere. */
export async function hayNecesidades(): Promise<boolean> {
  const snapshot = await getDb().collection(COLLECTIONS.necesidades).limit(1).get();
  return !snapshot.empty;
}

/** Upserts the catalogue — what the sheet sync derives from `Donaciones` on every edit. */
export async function guardarElementosEnLote(elementos: ElementoDonacion[]): Promise<void> {
  const db = getDb();

  for (let inicio = 0; inicio < elementos.length; inicio += LIMITE_LOTE) {
    const lote = db.batch();

    for (const elemento of elementos.slice(inicio, inicio + LIMITE_LOTE)) {
      const { id, ...data } = elemento;
      lote.set(db.collection(COLLECTIONS.catalogoDonaciones).doc(id), data, { merge: true });
    }

    await lote.commit();
  }
}

/**
 * Retires items the sheet no longer states, and the needs written against them.
 *
 * The sheet sends its whole table on every sync, so an item missing from
 * `idsVigentes` did not just go unedited — it was deleted from `Donaciones`
 * (or renamed, which is the same thing to an id built from categoría+nombre).
 * Same reasoning as `desactivarCentrosAusentes`: what disappears from the
 * sheet must disappear from the catalogue, not linger as a row nobody can
 * see was ever removed. Unlike a centre, an item has no reservation to keep
 * history for, so this deletes rather than deactivates.
 */
export async function eliminarElementosAusentes(idsVigentes: string[]): Promise<string[]> {
  const db = getDb();
  const vigentes = new Set(idsVigentes);
  const todos = await findElementos();
  const ausentes = todos.filter((elemento) => !vigentes.has(elemento.id));

  if (ausentes.length === 0) return [];

  const lote = db.batch();
  for (const elemento of ausentes) {
    lote.delete(db.collection(COLLECTIONS.catalogoDonaciones).doc(elemento.id));
  }
  await lote.commit();

  for (const elemento of ausentes) {
    const necesidadesHuerfanas = await db
      .collection(COLLECTIONS.necesidades)
      .where("elementoId", "==", elemento.id)
      .get();

    if (necesidadesHuerfanas.empty) continue;

    const loteNecesidades = db.batch();
    for (const doc of necesidadesHuerfanas.docs) {
      loteNecesidades.delete(db.collection(COLLECTIONS.necesidades).doc(doc.id));
    }
    await loteNecesidades.commit();
  }

  return ausentes.map((elemento) => elemento.id);
}
