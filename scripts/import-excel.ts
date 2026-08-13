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
 * Locates the header row of the `Centros` sheet and maps each column by its
 * title.
 *
 * The layout is not stable — between the first and second versions of the file the
 * header moved down a row, the coordinator columns disappeared and two new ones
 * appeared, which silently shifted every index. Reading by title means the next
 * reshuffle is a no-op here, and a genuinely missing column fails loudly
 * instead of importing the wrong cell.
 */
function mapearColumnas(sheet: ExcelJS.Worksheet): {
  headerRow: number;
  columna: (titulo: string) => number | null;
} {
  for (let rowNumber = 1; rowNumber <= Math.min(12, sheet.rowCount); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const titulos = new Map<string, number>();

    for (let col = 1; col <= sheet.columnCount; col += 1) {
      const texto = cellText(row, col);
      if (texto) titulos.set(normalizar(texto), col);
    }

    // The row that names both the point and its capacity is the header. The
    // capacity columns were renamed between versions — "Cupos AM" became
    // "Cupos Mañana" — so either spelling identifies the row.
    // Keys are already normalised, so "Cupos Mañana" is looked up as "cupos manana".
    if (titulos.has("direccion") && (titulos.has("cupos am") || titulos.has("cupos manana"))) {
      return {
        headerRow: rowNumber,
        columna: (titulo) => titulos.get(normalizar(titulo)) ?? null,
      };
    }
  }

  throw new Error("No encontré la fila de encabezados en la hoja 'Centros'.");
}

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** A jornada the file does not model is zero cupos, not a broken import. */
function cuposDe(row: ExcelJS.Row, column: number | null): number {
  return column ? cellNumber(row, column) : 0;
}

function readCentros(workbook: ExcelJS.Workbook): Centro[] {
  const sheet = workbook.getWorksheet("Centros");
  if (!sheet) throw new Error("El archivo no tiene la hoja 'Centros'.");

  const { headerRow, columna } = mapearColumnas(sheet);

  // The point's name column has been called both "Centro" and "Punto de acopio".
  const colNombre = columna("Punto de acopio") ?? columna("Centro");

  /**
   * The jornada columns have been renamed and dropped across versions: "Cupos AM"
   * became "Cupos Mañana", and the third version of the file has no afternoon
   * column at all — the points run two shifts, morning and night.
   *
   * So each jornada is read if its column exists and counted as zero otherwise,
   * and what fails loudly is a sheet with no capacity column at all. Requiring
   * all three would refuse the current file; requiring none would import every
   * centre with zero cupos and look like a working import that oversells nothing
   * because nothing is available.
   */
  const colCuposAm = columna("Cupos AM") ?? columna("Cupos Mañana");
  const colCuposPm = columna("Cupos PM") ?? columna("Cupos Tarde");
  const colCuposNoche = columna("Cupos Noche");

  if (!colNombre) {
    throw new Error("A la hoja 'Centros' le falta la columna del nombre del punto.");
  }

  if (!colCuposAm && !colCuposPm && !colCuposNoche) {
    throw new Error("A la hoja 'Centros' no le encontré ninguna columna de cupos por jornada.");
  }

  const colDireccion = columna("Dirección");
  const colLocalidad = columna("Localidad");
  const colHorario = columna("Horario oficial del punto");
  const colActividades = columna("Actividades habilitadas");
  const colLink = columna("Link Google Maps");
  const colActivo = columna("Activo");
  const colObservaciones = columna("Observaciones");

  const centros: Centro[] = [];

  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const nombre = cellText(row, colNombre);

    if (!nombre) continue;
    if (nombre.toUpperCase() === "TOTAL") continue;
    // Footnotes live below the table and are not points.
    if (/^(nota|supuesto|un cupo)/i.test(nombre)) break;

    const actividades = (readOptional(row, colActividades) ?? "")
      .split(",")
      .map((actividad) => actividad.trim())
      .filter(Boolean) as Centro["actividades"];

    centros.push({
      id: slugify(nombre),
      nombre,
      direccion: readOptional(row, colDireccion),
      localidad: readOptional(row, colLocalidad),
      linkMaps: readOptional(row, colLink),
      horarioOficial: readOptional(row, colHorario),
      observaciones: readOptional(row, colObservaciones),
      actividades,
      cuposPorJornada: {
        AM: cuposDe(row, colCuposAm),
        PM: cuposDe(row, colCuposPm),
        NOCHE: cuposDe(row, colCuposNoche),
      },
      activo: (readOptional(row, colActivo) ?? "Sí").toLowerCase().startsWith("s"),
      // The second version of the file dropped the coordinator columns. The
      // field stays so the shape does not change under the API; the admin panel
      // will fill it from its own source.
      coordinador: null,
    });
  }

  return centros;
}

function readOptional(row: ExcelJS.Row, column: number | null): string | null {
  return column === null ? null : cellText(row, column);
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

/** One shift per centre × date × slot, mirroring the `Turnos` sheet. */
function buildTurnos(centros: Centro[], fechas: string[]): Turno[] {
  const turnos: Turno[] = [];

  for (const centro of centros) {
    for (const fecha of fechas) {
      for (const jornada of JORNADAS) {
        const cupos = centro.cuposPorJornada[jornada] ?? 0;

        turnos.push({
          id: buildTurnoId(centro.id, fecha, jornada),
          centroId: centro.id,
          centroNombre: centro.nombre,
          fecha,
          diaSemana: diaSemana(fecha),
          jornada,
          horario: HORARIOS[jornada],
          horarioOficialCentro: centro.horarioOficial,
          centroActivo: centro.activo,
          cuposTotales: cupos,
          reservados: 0,
          // Zero capacity is how the spreadsheet says "this point does not open
          // in this shift" — Unicentro and Palacio close before the evening.
          // The sheet shows those as "Sin cupos" and the instructions are
          // explicit that they must not be bookable.
          estado: centro.activo && cupos > 0 ? "ABIERTO" : "CERRADO",
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

  const sinCupos = turnos.filter((turno) => turno.cuposTotales === 0);
  if (sinCupos.length > 0) {
    const porCentro = new Map<string, number>();
    for (const turno of sinCupos) {
      porCentro.set(turno.centroNombre, (porCentro.get(turno.centroNombre) ?? 0) + 1);
    }
    const detalle = [...porCentro].map(([nombre, total]) => `${nombre} (${total})`).join(", ");
    console.log(`\nTurnos cerrados por cupo 0: ${sinCupos.length} — ${detalle}`);
  }

  reportarHorariosEnConflicto(centros);

  const sinDireccion = centros.filter((centro) => !centro.direccion).map((centro) => centro.nombre);
  if (sinDireccion.length > 0) {
    console.warn(`\n⚠ Puntos sin dirección: ${sinDireccion.join(", ")}`);
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

  await retirarLoQueYaNoEstaAutorizado(db, batch, centros, existentes);

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

/**
 * Retires points that dropped out of the spreadsheet.
 *
 * The import merges, so without this a point removed from the file keeps being
 * served: the second version of the file dropped Vive Claro and CC Nuestro
 * Bogotá, and both would have stayed bookable. They are deactivated rather than
 * deleted — a reservation may already point at them, and the coordinators need
 * that history.
 */
async function retirarLoQueYaNoEstaAutorizado(
  db: FirebaseFirestore.Firestore,
  batch: FirebaseFirestore.WriteBatch,
  centros: Centro[],
  turnosExistentes: FirebaseFirestore.QuerySnapshot,
): Promise<void> {
  const vigentes = new Set(centros.map((centro) => centro.id));

  const centrosGuardados = await db.collection(COLLECTIONS.centros).get();
  const retirados = centrosGuardados.docs.filter((doc) => !vigentes.has(doc.id));

  for (const doc of retirados) {
    batch.set(doc.ref, { activo: false }, { merge: true });
  }

  for (const doc of turnosExistentes.docs) {
    const centroId = String(doc.data().centroId ?? "");
    if (!vigentes.has(centroId)) {
      batch.set(doc.ref, { estado: "CERRADO", centroActivo: false }, { merge: true });
    }
  }

  if (retirados.length > 0) {
    const nombres = retirados.map((doc) => String(doc.data().nombre ?? doc.id)).join(", ");
    console.log(`Puntos retirados (quedan inactivos, no se borran): ${nombres}`);
  }
}

/**
 * The evening shift runs 7–10 p.m., but several points close earlier. Publishing
 * a shift that ends after the door is locked sends volunteers to a closed site,
 * so the mismatch is surfaced on every import until the hours are reconciled.
 */
function reportarHorariosEnConflicto(centros: Centro[]): void {
  const conflictos = centros.filter((centro) => {
    if (!centro.horarioOficial || (centro.cuposPorJornada.NOCHE ?? 0) === 0) return false;
    if (/24\s*horas/i.test(centro.horarioOficial)) return false;

    const cierre = leerHoraDeCierre(centro.horarioOficial);
    return cierre !== null && cierre < 22 * 60;
  });

  if (conflictos.length === 0) return;

  console.warn(
    `\n⚠ La jornada noche (${HORARIOS.NOCHE.etiqueta}) se pasa del cierre en ${conflictos.length} punto(s):`,
  );
  for (const centro of conflictos) {
    console.warn(`   ${centro.nombre} — cierra ${centro.horarioOficial}`);
  }
  console.warn("   Los cupos siguen abiertos: alinear horarios antes de publicar la web.");
}

/** Reads the closing time out of "8:00 a.m. - 9:00 p.m." as minutes past midnight. */
function leerHoraDeCierre(horario: string): number | null {
  const partes = horario.split("-");
  const fin = partes[partes.length - 1]?.trim();
  if (!fin) return null;

  const match = /^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)$/i.exec(fin.replace(/\s+/g, " "));
  if (!match?.[1] || !match[3]) return null;

  const hora = Number(match[1]) % 12;
  const minutos = Number(match[2] ?? 0);
  const esPm = /^p/i.test(match[3]);

  return (hora + (esPm ? 12 : 0)) * 60 + minutos;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
