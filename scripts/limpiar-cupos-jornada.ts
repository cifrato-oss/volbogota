/**
 * Rewrites `centros.cuposPorJornada` with the two shifts the schema knows.
 *
 * `guardarCatalogo` writes with `{ merge: true }`, and a merge over a nested map
 * keeps every key it does not mention. So each rename left its keys behind and
 * the documents ended up carrying three models at once:
 *
 *   {"AM":150, "PM":0, "NOCHE":150, "MANANA":150}
 *
 * `centroSchema` reads `cuposPorJornada` as a record of `AM | PM`, so those extra
 * keys are unrecognised and the whole document is discarded — the API answered
 * `{"success":true,"data":[]}` with all six points sitting intact in Firestore.
 * Re-importing does not fix it: the importer merges too.
 *
 *   pnpm run limpiar:cupos              # dry run: muestra el antes y el después
 *   pnpm run limpiar:cupos -- --aplicar # escribe de verdad
 *
 * `MANANA` folds into `AM` and `NOCHE` into `PM`, which is the mapping the
 * importer already declares in `ALIAS_CUPOS`: "Cupos Noche" is the shift that
 * runs from 1 p.m. to closing time, and it is the same one `PM` names.
 *
 * Each shift takes the largest value among its aliases rather than a fixed
 * precedence. One of the keys is stale and there is no way to tell which from the
 * document alone — `PM: 0` here came from a column the spreadsheet does not have,
 * while `NOCHE: 150` is the real capacity. Taking the maximum can never silently
 * drop cupos, and the dry run prints every change so a human confirms it.
 *
 * `update()` and not `set(..., { merge: true })`: update replaces the field's
 * whole value, which is the point — a merge would leave the stale keys exactly
 * where they are.
 */

import { env } from "@/server/config/env";
import { COLLECTIONS, getDb } from "@/server/db/firestore";

/** Every name each shift has had, current name first. */
const ALIAS: Record<"AM" | "PM", string[]> = {
  AM: ["AM", "MANANA", "MAÑANA"],
  PM: ["PM", "TARDE", "NOCHE"],
};

const CANONICAS = new Set(["AM", "PM"]);

function resolver(cupos: Record<string, unknown>, jornada: "AM" | "PM"): number {
  const valores = ALIAS[jornada]
    .map((clave) => Number(cupos[clave]))
    .filter((valor) => Number.isFinite(valor) && valor >= 0);

  return valores.length === 0 ? 0 : Math.max(...valores);
}

async function main(): Promise<void> {
  const aplicar = process.argv.includes("--aplicar");
  const destino = process.env.FIRESTORE_EMULATOR_HOST
    ? `emulador (${process.env.FIRESTORE_EMULATOR_HOST})`
    : `proyecto real (${env.firebase.projectId || "sin project id"})`;

  console.log(`Conectando a: ${destino}\n`);

  const db = getDb();
  const snapshot = await db.collection(COLLECTIONS.centros).get();

  const pendientes: { id: string; antes: string; despues: Record<string, number> }[] = [];

  for (const doc of snapshot.docs) {
    const cupos = (doc.data().cuposPorJornada ?? {}) as Record<string, unknown>;
    const sobrantes = Object.keys(cupos).filter((clave) => !CANONICAS.has(clave));
    const despues = { AM: resolver(cupos, "AM"), PM: resolver(cupos, "PM") };

    const mismoValor = Number(cupos.AM ?? 0) === despues.AM && Number(cupos.PM ?? 0) === despues.PM;

    // Nothing to do when the document already holds exactly AM and PM with the
    // values the aliases resolve to.
    if (sobrantes.length === 0 && mismoValor) continue;

    pendientes.push({ id: doc.id, antes: JSON.stringify(cupos), despues });
  }

  if (pendientes.length === 0) {
    console.log("Todos los centros ya tienen solo AM y PM. Nada que hacer.");
    return;
  }

  console.log(`Centros por corregir: ${pendientes.length} de ${snapshot.size}\n`);

  for (const { id, antes, despues } of pendientes) {
    console.log(`  ${id}`);
    console.log(`    antes   ${antes}`);
    console.log(`    después ${JSON.stringify(despues)}`);
  }

  if (!aplicar) {
    console.log("\n--dry: no se escribió nada. Repite con --aplicar para guardar.");
    return;
  }

  const batch = db.batch();

  for (const { id, despues } of pendientes) {
    batch.update(db.collection(COLLECTIONS.centros).doc(id), { cuposPorJornada: despues });
  }

  await batch.commit();

  console.log(`\n✓ Corregidos ${pendientes.length} centros.`);
  console.log("Los turnos viejos de la jornada noche se limpian con: pnpm run limpiar:noche");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
