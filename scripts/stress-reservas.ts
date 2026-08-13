/**
 * Proves the booking endpoint cannot oversell a shift under concurrency.
 *
 * Temporarily shrinks a shift to `--cupos`, fires `--intentos` simultaneous
 * bookings at the running API, then checks that exactly `--cupos` succeeded and
 * that the counter matches the number of reservation documents.
 *
 * Requires the emulator and the dev server, both pointed at the same project:
 *
 *   npx firebase emulators:start --only firestore --project volbogota-local
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npm run dev
 *   npm run stress:reservas -- --turno cruz-roja_2026-08-16_pm
 *
 * Never run this against production: it rewrites the shift's capacity.
 */

import { COLLECTIONS, getDb } from "@/server/db/firestore";

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

async function main(): Promise<void> {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("Solo contra el emulador: exporta FIRESTORE_EMULATOR_HOST=localhost:8080.");
  }

  const turnoId = arg("turno", "cruz-roja_2026-08-16_pm");
  const cupos = Number(arg("cupos", "5"));
  const intentos = Number(arg("intentos", "40"));
  const baseUrl = arg("url", "http://localhost:3000");

  const db = getDb();
  const turnoRef = db.collection(COLLECTIONS.turnos).doc(turnoId);

  if (!(await turnoRef.get()).exists) {
    throw new Error(`El turno ${turnoId} no existe. ¿Corriste el import?`);
  }

  await turnoRef.update({ cuposTotales: cupos, reservados: 0 });

  // Wipe everything a previous run left behind, or the final count compares
  // this run's bookings against an accumulated total and reports a phantom
  // inconsistency.
  const inscritosPrevios = await turnoRef.collection(COLLECTIONS.inscritos).get();
  const reservasPrevias = await db
    .collection(COLLECTIONS.reservas)
    .where("turnoId", "==", turnoId)
    .get();

  await Promise.all(
    [...inscritosPrevios.docs, ...reservasPrevias.docs].map((doc) => doc.ref.delete()),
  );

  const respuestas = await Promise.all(
    Array.from({ length: intentos }, (_, index) =>
      fetch(`${baseUrl}/api/reservas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: `Voluntario Número ${index}`,
          celular: `3${String(100000000 + index).padStart(9, "0")}`,
          turnoId,
          actividad: "Empaque",
          autorizoDatos: true,
          mayorDeEdad: true,
        }),
      }).then((response) => response.status),
    ),
  );

  const creadas = respuestas.filter((status) => status === 201).length;
  const sinCupo = respuestas.filter((status) => status === 409).length;
  const inesperados = respuestas.filter((status) => status !== 201 && status !== 409);

  const turno = (await turnoRef.get()).data();
  const reservas = await db.collection(COLLECTIONS.reservas).where("turnoId", "==", turnoId).get();

  console.log(`intentos simultáneos : ${intentos}`);
  console.log(`cupos del turno      : ${cupos}`);
  console.log(`201 creadas          : ${creadas}`);
  console.log(`409 sin cupo         : ${sinCupo}`);
  console.log(`status inesperados   : ${inesperados.length} ${inesperados.join(", ")}`);
  console.log(`contador reservados  : ${turno?.reservados}`);
  console.log(`docs de reserva      : ${reservas.size}`);

  const consistente =
    creadas === cupos &&
    turno?.reservados === cupos &&
    reservas.size === cupos &&
    inesperados.length === 0;

  console.log(
    consistente
      ? "\n✓ Sin sobreventa: contador y documentos cuadran."
      : "\n✗ Inconsistencia: revisa la transacción.",
  );

  process.exit(consistente ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
