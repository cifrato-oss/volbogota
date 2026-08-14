import { env } from "@/server/config/env";
import { logger } from "@/server/lib/logger";

import {
  sincronizarCentrosSchema,
  sincronizarDonacionesSchema,
  sincronizarTurnosSchema,
  type FilaDonacion,
} from "./sheets.schema";
import {
  sincronizarCentrosDesdeSheet,
  sincronizarDonacionesDesdeSheet,
  sincronizarTurnosDesdeSheet,
} from "./sheets.service";

/**
 * Reads the spreadsheet directly, without Apps Script.
 *
 * The push from the sheet only fires when someone edits it, so a backend that
 * starts empty — a fresh deploy, or any restart under `DB_DRIVER=memory` —
 * stays empty until a human goes and edits a cell. Pulling the published CSV
 * closes that gap: it needs no credentials, only that the file is shared by
 * link, which it already is.
 */

function csvUrl(hoja: string): string {
  const id = env.sheetId;
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(hoja)}`;
}

/** Minimal CSV reader: quoted fields, doubled quotes, newlines inside quotes. */
export function parsearCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let entreComillas = false;

  for (let i = 0; i < texto.length; i += 1) {
    const caracter = texto[i];

    if (entreComillas) {
      if (caracter === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          entreComillas = false;
        }
      } else {
        campo += caracter;
      }
      continue;
    }

    if (caracter === '"') entreComillas = true;
    else if (caracter === ",") {
      fila.push(campo);
      campo = "";
    } else if (caracter === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else if (caracter !== "\r") {
      campo += caracter;
    }
  }

  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  return filas;
}

function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/**
 * Column index by title. The sheet keeps its own heading text inside the first
 * header cell, so a match has to be by containment, not equality.
 */
function indiceDe(encabezado: string[], titulo: string): number {
  const buscado = normalizar(titulo);
  return encabezado.findIndex((celda) => normalizar(celda).includes(buscado));
}

async function descargar(hoja: string): Promise<string[][]> {
  const respuesta = await fetch(csvUrl(hoja), { redirect: "follow" });

  if (!respuesta.ok) {
    throw new Error(`La hoja '${hoja}' respondió ${respuesta.status}.`);
  }

  return parsearCsv(await respuesta.text());
}

/**
 * The `Turnos` board, one row per shift — the same shape the live hook sends.
 *
 * A row this cannot read is skipped rather than thrown: the board carries
 * footer notes and half-typed rows, and one of them must not stop a cold start
 * from loading the eighty that are fine.
 */
async function leerTurnos(): Promise<Record<string, unknown>[]> {
  const filas = await descargar("Turnos");
  const indiceEncabezado = encontrarEncabezado(filas, ["Fecha", "Cupos totales"]);
  const encabezado = filas[indiceEncabezado] ?? [];

  const columnas = {
    puntoDeAcopio: indiceDe(encabezado, "Punto de acopio"),
    fecha: indiceDe(encabezado, "Fecha"),
    dia: indiceDe(encabezado, "Día"),
    jornada: indiceDe(encabezado, "Jornada"),
    horario: indiceDe(encabezado, "Horario"),
    cuposTotales: indiceDe(encabezado, "Cupos totales"),
  };

  if (columnas.puntoDeAcopio === -1 || columnas.jornada === -1) {
    throw new Error("La hoja 'Turnos' no trae las columnas esperadas.");
  }

  const turnos: Record<string, unknown>[] = [];

  for (let fila = indiceEncabezado + 1; fila < filas.length; fila += 1) {
    const valores = filas[fila] ?? [];
    const punto = valores[columnas.puntoDeAcopio]?.trim();
    const fecha = valores[columnas.fecha]?.trim();
    const jornada = valores[columnas.jornada]?.trim();

    // A half-filled row does not describe a shift yet.
    if (!punto || !fecha || !jornada) continue;

    turnos.push({
      // 1-based, matching the row Apps Script would report.
      fila: fila + 1,
      puntoDeAcopio: punto,
      fecha,
      jornada,
      dia: valores[columnas.dia]?.trim() || null,
      horario: valores[columnas.horario]?.trim() || null,
      cuposTotales: valores[columnas.cuposTotales]?.trim() || "0",
    });
  }

  return turnos;
}

async function leerCentros(): Promise<Record<string, string>[]> {
  const filas = await descargar("Centros");
  const encabezado = filas[0] ?? [];

  const columnas = {
    puntoDeAcopio: indiceDe(encabezado, "Punto de acopio"),
    direccion: indiceDe(encabezado, "Dirección"),
    localidad: indiceDe(encabezado, "Localidad"),
    horarioOficial: indiceDe(encabezado, "Horario oficial"),
    cuposAm: indiceDe(encabezado, "Cupos AM"),
    cuposPm: indiceDe(encabezado, "Cupos PM"),
    actividades: indiceDe(encabezado, "Actividades"),
    linkMaps: indiceDe(encabezado, "Link"),
    activo: indiceDe(encabezado, "Activo"),
    observaciones: indiceDe(encabezado, "Observaciones"),
  };

  if (columnas.puntoDeAcopio === -1 || columnas.cuposAm === -1) {
    throw new Error("La hoja 'Centros' no trae las columnas esperadas.");
  }

  const centros: Record<string, string>[] = [];

  for (const fila of filas.slice(1)) {
    const nombre = fila[columnas.puntoDeAcopio]?.trim();
    if (!nombre) continue;

    const centro: Record<string, string> = {};
    for (const [campo, indice] of Object.entries(columnas)) {
      if (indice !== -1) centro[campo] = fila[indice]?.trim() ?? "";
    }

    centros.push(centro);
  }

  return centros;
}

/**
 * Pulls the catalogue and applies it through the same paths the hooks use.
 *
 * Both sheets, in order: the points first, because a board row naming a point
 * the catalogue does not have yet would be rejected. They are two calls now
 * rather than one payload — the same split the live hooks made.
 */
export async function importarCatalogoDesdeCsv(): Promise<{ centros: number; turnos: number }> {
  if (!env.sheetId) {
    throw new Error("Falta SHEET_ID: sin él no hay hoja que leer.");
  }

  const centros = await sincronizarCentrosDesdeSheet(
    sincronizarCentrosSchema.parse({ filas: await leerCentros() }),
  );

  const turnos = await sincronizarTurnosDesdeSheet(
    sincronizarTurnosSchema.parse({ filas: await leerTurnos() }),
  );

  logger.info("Catálogo importado desde el CSV de la hoja", {
    centros: centros.centros,
    turnos: turnos.turnos,
    rechazadas: turnos.rechazadas.length,
  });

  return { centros: centros.centros, turnos: turnos.turnos };
}

/** Don't hammer Google when the sheet is unreachable or genuinely empty. */
const ESPERA_TRAS_FALLO_MS = 30_000;
let ultimoIntento = 0;
let enCurso: Promise<void> | null = null;

/**
 * Loads the catalogue on demand when the store has none.
 *
 * Called from the read routes so a cold backend answers with real data instead
 * of an empty list. Concurrent callers share one import, and a failure backs
 * off rather than retrying on every request.
 */
export async function asegurarCatalogo(hayCentros: boolean): Promise<void> {
  if (hayCentros || !env.sheetId) return;
  if (enCurso) return enCurso;
  if (Date.now() - ultimoIntento < ESPERA_TRAS_FALLO_MS) return;

  ultimoIntento = Date.now();

  enCurso = importarCatalogoDesdeCsv()
    .then(() => undefined)
    .catch((error) => {
      // Never fails the request: an empty list is a worse answer than stale
      // data, but a 500 is worse than both.
      logger.warn("No se pudo importar el catálogo desde la hoja", {
        motivo: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      enCurso = null;
    });

  return enCurso;
}

// --- Donaciones ("Donaciones" sheet) ---------------------------------------

/**
 * Finds the header row by content, not position.
 *
 * `Centros` and `Turnos` put theirs on row 1; `Donaciones` does not — a title,
 * a legend and a "last updated" stamp sit above it — so this scans the first
 * few rows the way Apps Script's own `mapearEncabezados` does.
 */
function encontrarEncabezado(filas: string[][], requeridas: string[]): number {
  const limite = Math.min(12, filas.length);

  for (let i = 0; i < limite; i += 1) {
    const fila = filas[i] ?? [];
    if (requeridas.every((titulo) => indiceDe(fila, titulo) !== -1)) return i;
  }

  throw new Error("No encontré la fila de encabezados de 'Donaciones'.");
}

/**
 * `Donaciones`: one row per item, one column per centre — the same shape
 * `sincronizarDonacionesDesdeSheet` expects from the live hook, built here
 * instead from the published CSV.
 */
async function leerDonaciones(): Promise<FilaDonacion[]> {
  const filas = await descargar("Donaciones");
  const indiceEncabezado = encontrarEncabezado(filas, ["Categoría", "Elemento"]);
  const encabezado = filas[indiceEncabezado] ?? [];

  const colCategoria = indiceDe(encabezado, "Categoría");
  const colElemento = indiceDe(encabezado, "Elemento");

  const columnasCentro: Array<{ columna: number; nombre: string }> = [];
  for (let col = colElemento + 1; col < encabezado.length; col += 1) {
    const nombre = encabezado[col]?.trim();
    if (nombre) columnasCentro.push({ columna: col, nombre });
  }

  if (columnasCentro.length === 0) {
    throw new Error("La hoja 'Donaciones' no tiene columnas de puntos de acopio.");
  }

  const filasDonacion: FilaDonacion[] = [];

  for (let fila = indiceEncabezado + 1; fila < filas.length; fila += 1) {
    const valores = filas[fila] ?? [];
    const categoria = valores[colCategoria]?.trim();
    const elemento = valores[colElemento]?.trim();
    if (!categoria || !elemento) continue;

    const estados: Record<string, string | null> = {};
    for (const centro of columnasCentro) {
      estados[centro.nombre] = valores[centro.columna]?.trim() || null;
    }

    // 1-based, matching the row Apps Script would report.
    filasDonacion.push({ fila: fila + 1, categoria, elemento, estados });
  }

  return filasDonacion;
}

/** Pulls the donation semaphore and applies it through the same path the hook uses. */
export async function importarNecesidadesDesdeCsv(): Promise<{
  elementos: number;
  necesidades: number;
  eliminados: string[];
}> {
  if (!env.sheetId) {
    throw new Error("Falta SHEET_ID: sin él no hay hoja que leer.");
  }

  const filas = await leerDonaciones();
  const input = sincronizarDonacionesSchema.parse({ filas });
  const resultado = await sincronizarDonacionesDesdeSheet(input);

  logger.info("Donaciones importadas desde el CSV de la hoja", {
    elementos: resultado.elementos,
    necesidades: resultado.necesidades,
    eliminados: resultado.eliminados.length,
  });

  return {
    elementos: resultado.elementos,
    necesidades: resultado.necesidades,
    eliminados: resultado.eliminados,
  };
}

const ESPERA_TRAS_FALLO_NECESIDADES_MS = 30_000;
let ultimoIntentoNecesidades = 0;
let enCursoNecesidades: Promise<void> | null = null;

/**
 * Loads the donation semaphore on demand when the store has none.
 *
 * Same reasoning as `asegurarCatalogo`: a fresh deploy, or a restart under
 * `DB_DRIVER=memory`, should not wait for a coordinator to touch a cell before
 * "Quiero donar" has real data to show.
 */
export async function asegurarNecesidades(hayNecesidades: boolean): Promise<void> {
  if (hayNecesidades || !env.sheetId) return;
  if (enCursoNecesidades) return enCursoNecesidades;
  if (Date.now() - ultimoIntentoNecesidades < ESPERA_TRAS_FALLO_NECESIDADES_MS) return;

  ultimoIntentoNecesidades = Date.now();

  enCursoNecesidades = importarNecesidadesDesdeCsv()
    .then(() => undefined)
    .catch((error) => {
      logger.warn("No se pudo importar las necesidades desde la hoja", {
        motivo: error instanceof Error ? error.message : String(error),
      });
    })
    .finally(() => {
      enCursoNecesidades = null;
    });

  return enCursoNecesidades;
}
