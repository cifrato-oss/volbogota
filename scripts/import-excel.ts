/**
 * Imports the master spreadsheet into Firestore.
 *
 * The spreadsheet administers the programme: coordinators edit centres,
 * capacity, addresses and activities there. This script pushes that catalogue
 * into Firestore, which is what serves traffic during the event.
 *
 *   npm run import:excel -- --file ./Voluntariado_Bogota_Centros_Acopio.xlsx
 *   npm run import:excel -- --file ./archivo.xlsx --dry
 *
 * Re-running is safe and expected — it is how a capacity change in the
 * spreadsheet reaches production. Live `reservados` counters are read first and
 * carried over, so an import never resets bookings.
 */

import ExcelJS from "exceljs";

import { COLLECTIONS, getDb } from "@/server/db/firestore";
import {
  ETIQUETA_JORNADA,
  HORARIOS,
  JORNADAS,
  buildTurnoId,
  slugify,
  type Centro,
  type Turno,
} from "@/server/modules/catalogo/catalogo.schema";

const DIAS_SEMANA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type Args = { file: string; dry: boolean };

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const fileIndex = argv.indexOf("--file");
  const file = fileIndex === -1 ? undefined : argv[fileIndex + 1];

  if (!file) {
    throw new Error("Falta --file <ruta al .xlsx>");
  }

  return { file, dry: argv.includes("--dry") };
}

function cellText(row: ExcelJS.Row, column: number): string | null {
  const value = row.getCell(column).value;
  if (value === null || value === undefined) return null;

  const text = typeof value === "object" && "text" in value ? String(value.text) : String(value);
  const trimmed = text.trim();
  return trimmed === "" ? null : trimmed;
}

function cellNumber(row: ExcelJS.Row, column: number): number {
  const value = row.getCell(column).value;
  const parsed = typeof value === "number" ? value : Number(cellText(row, column));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * `Centros` sheet. Header is on row 4, data from row 5 until the `TOTAL` row
 * (free-form notes follow it). Columns:
 *
 *   1 nombre · 2 dirección · 3 localidad · 4 horario oficial ·
 *   5 cupos AM · 6 cupos PM · 7 cupos Noche · 8 cupos/día · 9 cupos 4 días ·
 *   10 actividades · 11 link maps · 12 activo · 13 observaciones
 *
 * The sheet has no coordinator columns, so `coordinador` is always null here.
 */
function readCentros(workbook: ExcelJS.Workbook): Centro[] {
  const sheet = workbook.getWorksheet("Centros");
  if (!sheet) throw new Error("El archivo no tiene la hoja 'Centros'.");

  const centros: Centro[] = [];

  for (let rowNumber = 5; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const nombre = cellText(row, 1);

    if (!nombre) continue;
    // The TOTAL row closes the data; everything below it is free-form notes.
    if (nombre.toUpperCase() === "TOTAL") break;

    const actividades = (cellText(row, 10) ?? "")
      .split(",")
      .map((actividad) => actividad.trim())
      .filter(Boolean) as Centro["actividades"];

    centros.push({
      id: slugify(nombre),
      nombre,
      direccion: cellText(row, 2),
      localidad: cellText(row, 3),
      linkMaps: cellText(row, 11),
      actividades,
      cuposPorJornada: {
        AM: cellNumber(row, 5),
        PM: cellNumber(row, 6),
        NOCHE: cellNumber(row, 7),
      },
      activo: (cellText(row, 12) ?? "Sí").toLowerCase().startsWith("s"),
      coordinador: null,
    });
  }

  return centros;
}

/** `Listas` sheet, column C: the dates the programme runs. */
function readFechas(workbook: ExcelJS.Workbook): string[] {
  const sheet = workbook.getWorksheet("Listas");
  if (!sheet) throw new Error("El archivo no tiene la hoja 'Listas'.");

  const fechas = new Set<string>();

  for (let rowNumber = 3; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const value = sheet.getRow(rowNumber).getCell(3).value;
    if (value instanceof Date) {
      fechas.add(toIsoDate(value));
    } else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      fechas.add(value.slice(0, 10));
    }
  }

  if (fechas.size === 0) throw new Error("No encontré fechas en la hoja 'Listas'.");
  return [...fechas].sort();
}

/**
 * Excel stores dates at UTC midnight; reading them through the local time zone
 * can roll the day back. Formatting from the UTC parts keeps 2026-08-13 as
 * 2026-08-13 regardless of where this runs.
 */
function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function diaSemana(fecha: string): string {
  const date = new Date(`${fecha}T12:00:00Z`);
  return DIAS_SEMANA[date.getUTCDay()] ?? "";
}

/** One shift per centre × date × slot — the 84 rows the spreadsheet builds. */
function buildTurnos(centros: Centro[], fechas: string[]): Turno[] {
  const turnos: Turno[] = [];

  for (const centro of centros) {
    for (const fecha of fechas) {
      for (const jornada of JORNADAS) {
        turnos.push({
          id: buildTurnoId(centro.id, fecha, jornada),
          centroId: centro.id,
          centroNombre: centro.nombre,
          fecha,
          diaSemana: diaSemana(fecha),
          jornada,
          horario: HORARIOS[jornada],
          cuposTotales: centro.cuposPorJornada[jornada] ?? 0,
          reservados: 0,
          estado: centro.activo ? "ABIERTO" : "CERRADO",
          coordinador: null,
        });
      }
    }
  }

  return turnos;
}

async function main(): Promise<void> {
  const { file, dry } = parseArgs();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);

  const centros = readCentros(workbook);
  const fechas = readFechas(workbook);
  const turnos = buildTurnos(centros, fechas);

  console.log(`Centros: ${centros.length}`);
  console.log(`Fechas:  ${fechas.join(", ")}`);
  console.log(`Turnos:  ${turnos.length}`);
  console.log(
    `Cupos:   ${turnos.reduce((total, turno) => total + turno.cuposTotales, 0).toLocaleString("es-CO")}`,
  );

  const sinDireccion = centros.filter((centro) => !centro.direccion).map((centro) => centro.nombre);
  if (sinDireccion.length > 0) {
    console.warn(`\n⚠ Centros sin dirección: ${sinDireccion.join(", ")}`);
  }

  const sinCoordinador = centros
    .filter((centro) => !centro.coordinador)
    .map((centro) => centro.nombre);
  if (sinCoordinador.length > 0) {
    console.warn(`⚠ Centros sin coordinador: ${sinCoordinador.join(", ")}`);
  }

  if (dry) {
    console.log("\n--dry: no se escribió nada en Firestore.");
    return;
  }

  const db = getDb();

  // Carry over live counters so a re-import never wipes bookings already taken.
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

  batch.set(db.collection(COLLECTIONS.catalogos).doc("listas"), {
    fechas,
    jornadas: JORNADAS.map((jornada) => ({
      valor: jornada,
      etiqueta: ETIQUETA_JORNADA[jornada],
      horario: HORARIOS[jornada],
    })),
    actualizadoEn: new Date().toISOString(),
  });

  await batch.commit();

  const conservados = [...reservadosPrevios.values()].reduce((total, n) => total + n, 0);
  console.log(`\n✓ Importado. Reservas conservadas: ${conservados}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
