/**
 * Checks that the app can reach Firestore and reports what is stored.
 *
 * Run it right after wiring credentials and again after every import:
 *
 *   pnpm run verify:firestore
 *
 * It only reads. Nothing here writes, so it is safe against production.
 */

import { COLLECTIONS, getDb } from "@/server/db/firestore";
import { env } from "@/server/config/env";

async function main(): Promise<void> {
  const destino = process.env.FIRESTORE_EMULATOR_HOST
    ? `emulador (${process.env.FIRESTORE_EMULATOR_HOST})`
    : `proyecto real (${env.firebase.projectId || "sin project id"})`;

  console.log(`Conectando a: ${destino}\n`);

  const db = getDb();

  const [centros, turnos, reservas] = await Promise.all([
    db.collection(COLLECTIONS.centros).get(),
    db.collection(COLLECTIONS.turnos).get(),
    db.collection(COLLECTIONS.reservas).get(),
  ]);

  const activos = centros.docs.filter((doc) => doc.data().activo === true);
  const abiertos = turnos.docs.filter((doc) => doc.data().estado === "ABIERTO");
  const cupos = turnos.docs
    .filter((doc) => doc.data().centroActivo !== false)
    .reduce((total, doc) => total + (Number(doc.data().cuposTotales) || 0), 0);
  const reservados = turnos.docs
    .filter((doc) => doc.data().centroActivo !== false)
    .reduce((total, doc) => total + (Number(doc.data().reservados) || 0), 0);

  console.log(`Puntos      : ${centros.size} (${activos.length} activos)`);
  console.log(`Turnos      : ${turnos.size} (${abiertos.length} abiertos)`);
  console.log(`Cupos       : ${cupos.toLocaleString("es-CO")}`);
  console.log(`Reservados  : ${reservados.toLocaleString("es-CO")}`);
  console.log(`Reservas    : ${reservas.size} documentos`);

  if (centros.empty) {
    console.warn("\n⚠ No hay puntos. Falta correr `pnpm run import:excel -- --file <archivo>`.");
    process.exit(1);
  }

  // The counter is the source of truth for capacity; a drift means something
  // wrote reservations without going through the booking transaction.
  const cancelables = reservas.docs.filter((doc) => doc.data().estado !== "CANCELADO").length;
  if (cancelables !== reservados) {
    console.warn(
      `\n⚠ Descuadre: ${reservados} en los contadores de turno vs ${cancelables} reservas activas.`,
    );
  }

  console.log("\n✓ Firestore responde.");
}

main().catch((error: unknown) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
