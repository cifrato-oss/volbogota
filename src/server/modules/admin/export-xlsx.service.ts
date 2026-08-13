import ExcelJS from "exceljs";

import { construirFilas, ENCABEZADOS, type ExportFiltros } from "./export.service";

/**
 * The same reservations as the CSV, as a real workbook.
 *
 * This file exists against the reasoning written in `export.service.ts`, and
 * that note still stands: `exceljs` is a heavy dependency to carry in a
 * serverless bundle, and it slows a cold start on a backend that runs with
 * `minInstances: 0`. It is here because it was asked for, and it earns its
 * weight only through what a CSV cannot express — a frozen header, an
 * autofilter, column widths and text-typed phone numbers. A workbook that just
 * held the same flat grid would be a CSV that costs more to serve.
 *
 * Kept in its own module so the import is reachable only from the route that
 * asks for `formato=xlsx`. The CSV path never pulls it in.
 */

/** Roughly the width each column needs at its longest realistic value. */
const ANCHOS = [14, 18, 28, 14, 7, 24, 13, 10, 30, 14, 12, 10, 10, 8];

export async function exportarReservasXlsx(filtros: ExportFiltros = {}): Promise<Buffer> {
  const filas = await construirFilas(filtros);

  const libro = new ExcelJS.Workbook();
  libro.creator = "VolBogotá";
  const hoja = libro.addWorksheet("Inscritos");

  hoja.addRow([...ENCABEZADOS]);
  for (const fila of filas) hoja.addRow(fila);

  hoja.getRow(1).font = { bold: true };
  hoja.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFEFEF" },
  };

  // The header stays put while a coordinator scrolls a list of hundreds, and the
  // filter is what turns this into something they can actually work with — by
  // shift, by state, by centre — without exporting again.
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = { from: "A1", to: { row: 1, column: ENCABEZADOS.length } };

  ANCHOS.forEach((ancho, indice) => {
    hoja.getColumn(indice + 1).width = ancho;
  });

  /**
   * Phone numbers as text, explicitly.
   *
   * This is the one thing a CSV cannot get right. Excel reads `3001234567` as a
   * number, and a number loses its leading zero and eventually renders as
   * `3,00123E+09` — a phone a coordinator cannot call. Typing the column keeps
   * every digit visible.
   */
  hoja.getColumn(4).numFmt = "@";
  hoja.getColumn(4).alignment = { horizontal: "left" };

  const buffer = await libro.xlsx.writeBuffer();

  return Buffer.from(buffer);
}
