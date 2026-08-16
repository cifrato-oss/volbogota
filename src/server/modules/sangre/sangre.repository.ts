import { COLLECTIONS, getDb } from "@/server/db/firestore";
import { parseValidos } from "@/server/db/parse-validos";

import { bancoSangreSchema, type BancoSangre } from "./sangre.schema";

/** Firestore reads and writes for the blood banks. */

export async function findBancos(soloActivos = true): Promise<BancoSangre[]> {
  const db = getDb();
  let query = db.collection(COLLECTIONS.bancosSangre) as FirebaseFirestore.Query;

  if (soloActivos) query = query.where("activo", "==", true);

  const snapshot = await query.get();

  // Sorted in memory for the same reason as `findCentros`: pairing `where` with
  // `orderBy` needs a composite index, and there are six of these.
  return parseValidos(COLLECTIONS.bancosSangre, snapshot.docs, bancoSangreSchema).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es"),
  );
}

export async function findBancoPorId(id: string): Promise<BancoSangre | null> {
  const doc = await getDb().collection(COLLECTIONS.bancosSangre).doc(id).get();
  if (!doc.exists) return null;

  const parsed = bancoSangreSchema.safeParse({ id: doc.id, ...doc.data() });
  return parsed.success ? parsed.data : null;
}

/** Firestore's batch write cap is 500; the sheet will never approach it, but the chunking is free. */
const LIMITE_LOTE = 400;

export async function guardarBancosEnLote(bancos: BancoSangre[]): Promise<void> {
  const db = getDb();

  for (let inicio = 0; inicio < bancos.length; inicio += LIMITE_LOTE) {
    const lote = db.batch();

    for (const banco of bancos.slice(inicio, inicio + LIMITE_LOTE)) {
      const { id, ...data } = banco;
      lote.set(db.collection(COLLECTIONS.bancosSangre).doc(id), data, { merge: true });
    }

    await lote.commit();
  }
}

/**
 * Deactivates banks the sheet stopped naming.
 *
 * Deletion is deliberately not used: a donor may have the page open, and a bank
 * that vanishes mid-session renders as a blank card. Marking it inactive lets
 * the reader drop it on the next snapshot with an explanation available.
 */
export async function desactivarBancosAusentes(idsPresentes: string[]): Promise<number> {
  const db = getDb();
  const snapshot = await db.collection(COLLECTIONS.bancosSangre).get();
  const presentes = new Set(idsPresentes);

  // Seeded banks are never in the sheet, so without this exemption the first
  // sync after a seed would deactivate all of them — and whoever was building
  // against that data would watch it vanish for no visible reason.
  const ausentes = snapshot.docs.filter(
    (doc) => !presentes.has(doc.id) && doc.data().activo !== false && doc.data().esMock !== true,
  );

  if (ausentes.length === 0) return 0;

  const lote = db.batch();
  for (const doc of ausentes) lote.set(doc.ref, { activo: false }, { merge: true });
  await lote.commit();

  return ausentes.length;
}
