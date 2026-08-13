import { env } from "@/server/config/env";
import { logger } from "@/server/lib/logger";

import { fechaDesdeSheet } from "./sheets.mapper";
import { sincronizarCentrosSchema } from "./sheets.schema";
import { sincronizarCentrosDesdeSheet } from "./sheets.service";

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

/** Programme dates, taken from the `Turnos` sheet's own date column. */
async function leerFechas(): Promise<string[]> {
  const filas = await descargar("Turnos");
  const encabezado = filas[0] ?? [];
  const columna = indiceDe(encabezado, "Fecha");

  if (columna === -1) return [];

  const fechas = new Set<string>();

  for (const fila of filas.slice(1)) {
    const valor = fila[columna]?.trim();
    if (!valor) continue;

    try {
      fechas.add(fechaDesdeSheet(valor));
    } catch {
      // Footer rows and stray text live in this column too.
    }
  }

  return [...fechas].sort();
}

async function leerCentros(): Promise<Record<string, string>[]> {
  const filas = await descargar("Centros");
  const encabezado = filas[0] ?? [];

  // "Cupos AM" became "Cupos Mañana" when the sheet moved to two shifts —
  // either spelling is accepted so an older copy of the sheet still imports.
  const columnas = {
    puntoDeAcopio: indiceDe(encabezado, "Punto de acopio"),
    direccion: indiceDe(encabezado, "Dirección"),
    localidad: indiceDe(encabezado, "Localidad"),
    horarioOficial: indiceDe(encabezado, "Horario oficial"),
    apertura: indiceDe(encabezado, "Apertura"),
    cierre: indiceDe(encabezado, "Cierre"),
    cuposManana: (() => {
      const manana = indiceDe(encabezado, "Cupos Mañana");
      return manana !== -1 ? manana : indiceDe(encabezado, "Cupos AM");
    })(),
    cuposNoche: indiceDe(encabezado, "Cupos Noche"),
    actividades: indiceDe(encabezado, "Actividades"),
    linkMaps: indiceDe(encabezado, "Link"),
    activo: indiceDe(encabezado, "Activo"),
    observaciones: indiceDe(encabezado, "Observaciones"),
  };

  if (columnas.puntoDeAcopio === -1 || columnas.cuposManana === -1) {
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

/** Pulls the catalogue and applies it through the same path the hook uses. */
export async function importarCatalogoDesdeCsv(): Promise<{ centros: number; turnos: number }> {
  if (!env.sheetId) {
    throw new Error("Falta SHEET_ID: sin él no hay hoja que leer.");
  }

  const [filas, fechas] = await Promise.all([leerCentros(), leerFechas()]);

  const input = sincronizarCentrosSchema.parse({
    filas,
    fechas: fechas.length > 0 ? fechas : undefined,
  });

  const resultado = await sincronizarCentrosDesdeSheet(input);

  logger.info("Catálogo importado desde el CSV de la hoja", {
    centros: resultado.centros,
    turnos: resultado.turnos,
  });

  return resultado;
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
