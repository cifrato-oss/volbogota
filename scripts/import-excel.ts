/**
 * Imports the master spreadsheet into Firestore.
 *
 * The spreadsheet administers the programme: coordinators edit centres,
 * capacity, addresses and — since the "Quiero donar" flow shipped — the
 * donation catalogue and its per-centre need states there. This script pushes
 * all of that into Firestore, which is what serves traffic during the event.
 *
 *   npm run import:excel -- --file ./Centros_de_Acopio_Bogota.xlsx
 *   npm run import:excel -- --file ./archivo.xlsx --dry
 *
 * Re-running is safe and expected — it is how a capacity change or a
 * semaphore flip in the spreadsheet reaches production. Live `reservados`
 * counters are read first and carried over, so an import never resets
 * bookings.
 */

import ExcelJS from "exceljs";

import { COLLECTIONS, getDb } from "@/server/db/firestore";
import {
  ETIQUETA_JORNADA,
  DESCRIPCION_JORNADA,
  JORNADAS,
  buildTurnoId,
  horarioDeJornada,
  slugify,
  type Centro,
  type Turno,
} from "@/server/modules/catalogo/catalogo.schema";
import {
  CATEGORIAS_DONACION,
  buildElementoId,
  buildNecesidadId,
  type CategoriaDonacion,
  type ElementoDonacion,
  type EstadoNecesidad,
  type Necesidad,
} from "@/server/modules/donaciones/donaciones.schema";

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
 * Reads a time-only cell (`Apertura`, `Cierre`) as `HH:MM`.
 *
 * Excel stores a time-only value as a `Date` on 1899-12-30 in UTC, so the wall
 * clock is the UTC hour/minute, not the local one. A plain-text cell like
 * `"8:00"` is accepted too, since that is what a hand-typed edit looks like.
 */
function cellHora(row: ExcelJS.Row, column: number | null): string | null {
  if (column === null) return null;

  const value = row.getCell(column).value;
  if (value instanceof Date) {
    const horas = String(value.getUTCHours()).padStart(2, "0");
    const minutos = String(value.getUTCMinutes()).padStart(2, "0");
    return `${horas}:${minutos}`;
  }

  const texto = cellText(row, column);
  const match = texto ? /^(\d{1,2}):(\d{2})/.exec(texto) : null;
  return match?.[1] && match[2] ? `${match[1].padStart(2, "0")}:${match[2]}` : null;
}

/** Reads a datetime cell (the `Necesidades` sheet's "Última actualización" row) as ISO. */
function cellFechaHora(row: ExcelJS.Row, column: number): string | null {
  const value = row.getCell(column).value;
  if (value instanceof Date) return value.toISOString();
  return cellText(row, column);
}

/**
 * Locates a sheet's header row by the set of column titles it must contain,
 * and returns a lookup from title to column index.
 *
 * The layout is not stable across revisions of the file — headers move rows,
 * columns get added or renamed. Reading by title means a reshuffle is a no-op
 * here, and a genuinely missing column fails loudly instead of importing the
 * wrong cell.
 */
function mapearColumnas(
  sheet: ExcelJS.Worksheet,
  requeridos: string[],
): { headerRow: number; columna: (titulo: string) => number | null } {
  for (let rowNumber = 1; rowNumber <= Math.min(12, sheet.rowCount); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const titulos = new Map<string, number>();

    for (let col = 1; col <= sheet.columnCount; col += 1) {
      const texto = cellText(row, col);
      if (texto) titulos.set(normalizar(texto), col);
    }

    if (requeridos.every((titulo) => titulos.has(titulo))) {
      return { headerRow: rowNumber, columna: (titulo) => titulos.get(normalizar(titulo)) ?? null };
    }
  }

  throw new Error(`No encontré la fila de encabezados en la hoja '${sheet.name}'.`);
}

function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function readOptional(row: ExcelJS.Row, column: number | null): string | null {
  return column === null ? null : cellText(row, column);
}

/** A jornada the file does not model is zero cupos, not a broken import. */
function cuposDe(row: ExcelJS.Row, column: number | null): number {
  return column ? cellNumber(row, column) : 0;
}

// --- Centros ----------------------------------------------------------------

function readCentros(workbook: ExcelJS.Workbook): Centro[] {
  const sheet = workbook.getWorksheet("Centros");
  if (!sheet) throw new Error("El archivo no tiene la hoja 'Centros'.");

  const { headerRow, columna } = mapearColumnas(sheet, ["direccion"]);

  // The point's name column has been called both "Centro" and "Punto de acopio".
  const colNombre = columna("Punto de acopio") ?? columna("Centro");

  if (!colNombre) {
    throw new Error("A la hoja 'Centros' le falta la columna del nombre del punto.");
  }

  /**
   * The jornada columns have been renamed and dropped across versions: "Cupos AM"
   * became "Cupos Mañana", and the current file has no afternoon column at all —
   * the points run two shifts, morning and night.
   *
   * So each jornada is read if its column exists and counted as zero otherwise,
   * and what fails loudly is a sheet with no capacity column at all.
   */
  const colCuposManana = columna("Cupos Mañana") ?? columna("Cupos AM");
  const colCuposNoche = columna("Cupos Noche");

  if (!colCuposManana && !colCuposNoche) {
    throw new Error("A la hoja 'Centros' no le encontré ninguna columna de cupos por jornada.");
  }

  const colDireccion = columna("Dirección");
  const colLocalidad = columna("Localidad");
  const colHorario = columna("Horario oficial del punto");
  const colApertura = columna("Apertura");
  const colCierre = columna("Cierre");
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
    if (/^(nota|supuesto|un cupo|jornada)/i.test(nombre)) break;

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
      apertura: cellHora(row, colApertura),
      cierre: cellHora(row, colCierre),
      observaciones: readOptional(row, colObservaciones),
      actividades,
      cuposPorJornada: {
        MANANA: cuposDe(row, colCuposManana),
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
          horario: horarioDeJornada(centro, jornada),
          horarioOficialCentro: centro.horarioOficial,
          centroActivo: centro.activo,
          cuposTotales: cupos,
          reservados: 0,
          // Zero capacity is how the spreadsheet says "this point does not open
          // in this shift" — the instructions are explicit that those shifts
          // must not be bookable.
          estado: centro.activo && cupos > 0 ? "ABIERTO" : "CERRADO",
          coordinador: null,
        });
      }
    }
  }

  return turnos;
}

// --- Catálogo de donaciones ---------------------------------------------------

function parsearCategoria(valor: string, contexto: string): CategoriaDonacion {
  const categoria = CATEGORIAS_DONACION.find((candidata) => candidata === valor.trim());

  if (!categoria) {
    throw new Error(
      `${contexto}: la categoría "${valor}" no es una de las 5 válidas (${CATEGORIAS_DONACION.join(", ")}).`,
    );
  }

  return categoria;
}

/** `Catálogo` sheet: the master list of items, few and stable — the donation "vocabulary". */
function readCatalogoDonaciones(workbook: ExcelJS.Workbook): ElementoDonacion[] {
  const sheet = workbook.getWorksheet("Catálogo");
  if (!sheet) throw new Error("El archivo no tiene la hoja 'Catálogo'.");

  const { headerRow, columna } = mapearColumnas(sheet, ["categoria", "orden", "elemento"]);

  const colCategoria = columna("Categoría");
  const colOrden = columna("Orden");
  const colElemento = columna("Elemento");
  const colMensaje = columna("Mensaje que va en la categoría") ?? columna("Mensaje");

  if (!colCategoria || !colOrden || !colElemento) {
    throw new Error("A la hoja 'Catálogo' le faltan columnas obligatorias.");
  }

  const elementos: ElementoDonacion[] = [];

  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const nombre = cellText(row, colElemento);
    const categoriaTexto = cellText(row, colCategoria);

    if (!nombre || !categoriaTexto) continue;

    const categoria = parsearCategoria(categoriaTexto, `Fila ${rowNumber} de 'Catálogo'`);

    elementos.push({
      id: buildElementoId(categoria, nombre),
      categoria,
      orden: cellNumber(row, colOrden),
      nombre,
      mensaje: readOptional(row, colMensaje),
    });
  }

  return elementos;
}

// --- Necesidades ---------------------------------------------------------------

const ESTADO_DESDE_SHEET: Record<string, EstadoNecesidad> = {
  "se necesita": "SE_NECESITA",
  suficiente: "SUFICIENTE",
  "no aplica": "NO_APLICA",
};

function parsearEstadoNecesidad(valor: string | null): EstadoNecesidad | null {
  return valor ? (ESTADO_DESDE_SHEET[normalizar(valor)] ?? null) : null;
}

/**
 * `Necesidades` sheet: the semaphore. One row per item, one column per centre,
 * plus a row above the header with each column's own "last updated" stamp.
 *
 * A blank cell means the pair has never been set and is skipped here — the
 * service layer is what defaults an unset pair to `SE_NECESITA`, not the
 * import, so a re-import never overwrites a state the sheet has gone quiet on
 * with a stale default.
 */
function readNecesidades(workbook: ExcelJS.Workbook): Necesidad[] {
  const sheet = workbook.getWorksheet("Necesidades");
  if (!sheet) throw new Error("El archivo no tiene la hoja 'Necesidades'.");

  const { headerRow, columna } = mapearColumnas(sheet, ["categoria", "elemento"]);
  const colCategoria = columna("Categoría");
  const colElemento = columna("Elemento");

  if (!colCategoria || !colElemento) {
    throw new Error("A la hoja 'Necesidades' le faltan columnas obligatorias.");
  }

  const filaEncabezado = sheet.getRow(headerRow);
  const filaActualizacion = sheet.getRow(Math.max(1, headerRow - 1));

  const centros: Array<{
    columna: number;
    centroId: string;
    centroNombre: string;
    actualizadoEn: string | null;
  }> = [];

  for (let col = colElemento + 1; col <= sheet.columnCount; col += 1) {
    const nombre = cellText(filaEncabezado, col);
    if (!nombre) continue;

    centros.push({
      columna: col,
      centroId: slugify(nombre),
      centroNombre: nombre,
      actualizadoEn: cellFechaHora(filaActualizacion, col),
    });
  }

  if (centros.length === 0) {
    throw new Error("La hoja 'Necesidades' no tiene columnas de puntos de acopio.");
  }

  const necesidades: Necesidad[] = [];

  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const elemento = cellText(row, colElemento);
    const categoriaTexto = cellText(row, colCategoria);

    if (!elemento || !categoriaTexto) continue;

    const categoria = parsearCategoria(categoriaTexto, `Fila ${rowNumber} de 'Necesidades'`);
    const elementoId = buildElementoId(categoria, elemento);

    for (const centro of centros) {
      const estado = parsearEstadoNecesidad(cellText(row, centro.columna));
      if (!estado) continue;

      necesidades.push({
        id: buildNecesidadId(centro.centroId, elementoId),
        centroId: centro.centroId,
        centroNombre: centro.centroNombre,
        elementoId,
        categoria,
        elemento,
        estado,
        actualizadoEn: centro.actualizadoEn,
      });
    }
  }

  return necesidades;
}

/** Firestore's batch write cap is 500 — chunked so the donation tables can grow past it safely. */
const LIMITE_LOTE = 400;

async function escribirEnLotes(
  db: FirebaseFirestore.Firestore,
  coleccion: string,
  items: Array<{ id: string } & Record<string, unknown>>,
): Promise<void> {
  for (let inicio = 0; inicio < items.length; inicio += LIMITE_LOTE) {
    const lote = db.batch();

    for (const item of items.slice(inicio, inicio + LIMITE_LOTE)) {
      const { id, ...data } = item;
      lote.set(db.collection(coleccion).doc(id), data, { merge: true });
    }

    await lote.commit();
  }
}

async function main(): Promise<void> {
  const { file, dry } = parseArgs();

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);

  const centros = readCentros(workbook);
  const fechas = readFechas(workbook);
  const turnos = buildTurnos(centros, fechas);
  const elementos = readCatalogoDonaciones(workbook);
  const necesidades = readNecesidades(workbook);

  console.log(`Centros:     ${centros.length}`);
  console.log(`Fechas:      ${fechas.join(", ")}`);
  console.log(`Turnos:      ${turnos.length}`);
  console.log(
    `Cupos:       ${turnos.reduce((total, turno) => total + turno.cuposTotales, 0).toLocaleString("es-CO")}`,
  );
  console.log(`Elementos:   ${elementos.length} (catálogo de donaciones)`);
  console.log(`Necesidades: ${necesidades.length} (elemento × punto con estado declarado)`);

  const sinCupos = turnos.filter((turno) => turno.cuposTotales === 0);
  if (sinCupos.length > 0) {
    const porCentro = new Map<string, number>();
    for (const turno of sinCupos) {
      porCentro.set(turno.centroNombre, (porCentro.get(turno.centroNombre) ?? 0) + 1);
    }
    const detalle = [...porCentro].map(([nombre, total]) => `${nombre} (${total})`).join(", ");
    console.log(`\nTurnos cerrados por cupo 0: ${sinCupos.length} — ${detalle}`);
  }

  reportarHorariosSinConfirmar(centros);
  reportarInconsistenciasDonaciones(centros, elementos, necesidades);

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
      descripcion: DESCRIPCION_JORNADA[jornada],
    })),
    categoriasDonacion: [...CATEGORIAS_DONACION],
    actualizadoEn: new Date().toISOString(),
  });

  await batch.commit();
  await escribirEnLotes(db, COLLECTIONS.catalogoDonaciones, elementos);
  await escribirEnLotes(db, COLLECTIONS.necesidades, necesidades);

  const conservados = [...reservadosPrevios.values()].reduce((total, n) => total + n, 0);
  console.log(`\n✓ Importado. Reservas conservadas: ${conservados}`);
}

/**
 * Retires points that dropped out of the spreadsheet.
 *
 * The import merges, so without this a point removed from the file keeps being
 * served. They are deactivated rather than deleted — a reservation may already
 * point at them, and the coordinators need that history.
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
 * Under the old fixed three-shift table, the evening shift's nominal end could
 * fall after a point's real closing time. That mismatch cannot happen anymore:
 * Noche's `fin` is now read straight from the centre's own `cierre`. What can
 * still happen is a centre that has not confirmed its hours at all — Estadio
 * El Campín shipped without them — so the shift ends up with a "Horario por
 * confirmar" placeholder instead of a real time. That is what this flags.
 */
function reportarHorariosSinConfirmar(centros: Centro[]): void {
  const sinApertura = centros.filter(
    (centro) => (centro.cuposPorJornada.MANANA ?? 0) > 0 && !centro.apertura,
  );
  const sinCierre = centros.filter(
    (centro) => (centro.cuposPorJornada.NOCHE ?? 0) > 0 && !centro.cierre,
  );

  if (sinApertura.length === 0 && sinCierre.length === 0) return;

  console.warn(
    "\n⚠ Puntos con cupos pero sin hora confirmada — su turno mostrará 'Horario por confirmar':",
  );
  for (const centro of sinApertura) console.warn(`   ${centro.nombre} — falta Apertura (Mañana)`);
  for (const centro of sinCierre) console.warn(`   ${centro.nombre} — falta Cierre (Noche)`);
}

/**
 * The three donation sheets are edited by different people at different times
 * — a coordinator can add a point to `Centros` before the semaphore for it
 * exists in `Necesidades`, or rename an item in one sheet and not the other.
 * None of this blocks the import: a point with no needs yet is not a bad
 * import, just an incomplete one, and the warning is what makes it visible.
 */
function reportarInconsistenciasDonaciones(
  centros: Centro[],
  elementos: ElementoDonacion[],
  necesidades: Necesidad[],
): void {
  const idsElementos = new Set(elementos.map((elemento) => elemento.id));
  const idsCentros = new Set(centros.map((centro) => centro.id));

  const huerfanas = necesidades.filter((necesidad) => !idsElementos.has(necesidad.elementoId));
  if (huerfanas.length > 0) {
    console.warn(
      `\n⚠ ${huerfanas.length} fila(s) de 'Necesidades' no coinciden con ningún elemento de 'Catálogo'.`,
    );
  }

  const centrosDesconocidos = new Set(
    necesidades
      .filter((necesidad) => !idsCentros.has(necesidad.centroId))
      .map((necesidad) => necesidad.centroNombre),
  );
  if (centrosDesconocidos.size > 0) {
    console.warn(
      `\n⚠ 'Necesidades' tiene columnas para puntos que no están en 'Centros': ${[...centrosDesconocidos].join(", ")}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
