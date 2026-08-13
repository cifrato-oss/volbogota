/**
 * Deletes the shift documents left behind when the evening slot was retired.
 *
 * `guardarCatalogo` merges the shifts it builds and never deletes the ones it
 * stopped building, so every `*_noche` document survives the change to two
 * shifts a day. They no longer parse against the schema, so listings drop them
 * with a warning on every request and a direct lookup answers 404 — harmless,
 * but noisy and misleading in the console.
 *
 *   pnpm run limpiar:noche              # dry run: solo lista lo que borraría
 *   pnpm run limpiar:noche -- --aplicar # borra de verdad
 *
 * A shift with bookings is never deleted: its reservations still point at it,
 * and losing that history is worse than an orphan document.
 */

import { COLLECTIONS, getDb } from "@/server/db/firestore";
import { env } from "@/server/config/env";

const SUFIJO_NOCHE = "_noche";

async function main(): Promise<void> {
  const aplicar = process.argv.includes("--aplicar");
  const destino = process.env.FIRESTORE_EMULATOR_HOST
    ? `emulador (${process.env.FIRESTORE_EMULATOR_HOST})`
    : `proyecto real (${env.firebase.projectId || "sin project id"})`;

  console.log(`Conectando a: ${destino}\n`);

  const db = getDb();
  const turnos = await db.collection(COLLECTIONS.turnos).get();
  const noche = turnos.docs.filter((doc) => doc.id.endsWith(SUFIJO_NOCHE));

  if (noche.length === 0) {
    console.log("No quedan turnos de la jornada noche. Nada que hacer.");
    return;
  }

  const conReservas = noche.filter((doc) => (Number(doc.data().reservados) || 0) > 0);
  const borrables = noche.filter((doc) => (Number(doc.data().reservados) || 0) === 0);

  console.log(`Turnos de jornada noche: ${noche.length}`);
  console.log(`  Sin reservas (se borran)   : ${borrables.length}`);
  console.log(`  Con reservas (se conservan): ${conReservas.length}`);

  if (conReservas.length > 0) {
    console.warn("\n⚠ Estos quedan intactos porque tienen voluntarios inscritos:");
    for (const doc of conReservas) {
      console.warn(`   ${doc.id} — ${doc.data().reservados} reservado(s)`);
    }
    console.warn("   Reubica esas reservas a un turno AM o PM antes de borrarlos.");
  }

  if (!aplicar) {
    console.log("\nSimulación. Corre con `-- --aplicar` para borrarlos de verdad.");
    return;
  }

  // Firestore caps a batch at 500 writes; the programme has 24 of these, but
  // chunking keeps the script correct if it is ever run on a longer calendar.
  const TAMANO_LOTE = 400;

  for (let inicio = 0; inicio < borrables.length; inicio += TAMANO_LOTE) {
    const batch = db.batch();
    for (const doc of borrables.slice(inicio, inicio + TAMANO_LOTE)) batch.delete(doc.ref);
    await batch.commit();
  }

  console.log(`\nBorrados ${borrables.length} turnos de jornada noche.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
