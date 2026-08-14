import { COLLECTIONS, getDb } from "@/server/db/firestore";
import { etiquetaJornada } from "@/server/modules/catalogo/catalogo.schema";
import { reservaSchema, type EstadoReserva } from "@/server/modules/reservas/reservas.schema";

/**
 * Exports the reservations back to the spreadsheet.
 *
 * CSV rather than a generated .xlsx: it keeps a heavy spreadsheet library out
 * of the serverless bundle, and every tool the coordinators use opens it.
 *
 * The columns are the contract's, not the sheet's. They used to be described as
 * the `Reservas` sheet's own order so a paste would land in the right cells,
 * but that stopped being true — the sheet carries 21 columns, including
 * `Validación` in the fifth position and several the API does not model, and
 * carries no age. Pasting this into it would misalign every row. Keeping the
 * contract's shape is the honest option now that `/api/hooks/sheets/reservas`
 * is what actually writes back into the sheet, column by column.
 *
 * Two details make the difference between a file that opens clean and one that
 * shows `Ana MarÃ­a` in mangled columns: a UTF-8 BOM, and semicolons — which is
 * what Excel expects under a Spanish locale.
 */

const SEPARADOR = ";";
const BOM = "\uFEFF";

/** The contract's fields, in the order a coordinator expects to read them. */
const ENCABEZADOS = [
  "ID",
  "Fecha/hora registro",
  "Nombre completo",
  "Celular",
  "Edad",
  "Punto de acopio",
  "Fecha jornada",
  "Jornada",
  "ID_Turno",
  "Autorizó datos",
  "Estado",
  "Check-in",
  "Check-out",
  "Horas",
  "Contacto emergencia",
  "Cel. emergencia",
  "EPS",
] as const;

const ETIQUETA_ESTADO: Record<EstadoReserva, string> = {
  RESERVADO: "Reservado",
  CONFIRMADO: "Confirmado",
  ASISTIO: "Asistió",
  NO_ASISTIO: "No asistió",
  CANCELADO: "Cancelado",
};

export type ExportFiltros = { fecha?: string; centro?: string };

/**
 * The rows both formats share.
 *
 * Kept apart so the CSV and the workbook can never drift into showing different
 * columns for the same reservation — the kind of difference nobody notices until
 * a coordinator compares two files at a door.
 */
export async function construirFilas(filtros: ExportFiltros = {}): Promise<string[][]> {
  const db = getDb();
  let query = db.collection(COLLECTIONS.reservas) as FirebaseFirestore.Query;

  if (filtros.fecha) query = query.where("fecha", "==", filtros.fecha);
  if (filtros.centro) query = query.where("centroId", "==", filtros.centro);

  const snapshot = await query.orderBy("creadoEn", "asc").get();

  return snapshot.docs.map((doc) => {
    const reserva = reservaSchema.parse({ id: doc.id, ...doc.data() });

    return [
      reserva.codigo,
      formatearFechaHora(reserva.creadoEn),
      `${reserva.nombre} ${reserva.apellido}`,
      reserva.celular,
      String(reserva.edad),
      reserva.centroNombre,
      reserva.fecha,
      etiquetaJornada(reserva.jornada),
      reserva.turnoId,
      reserva.autorizoDatos ? "Sí" : "No",
      ETIQUETA_ESTADO[reserva.estado],
      reserva.checkIn ?? "",
      reserva.checkOut ?? "",
      reserva.horas === null ? "" : String(reserva.horas).replace(".", ","),
      reserva.nombreEmergencia ?? "",
      reserva.contactoEmergencia ?? "",
      reserva.eps ?? "",
    ];
  });
}

export { ENCABEZADOS };

export async function exportarReservasCsv(filtros: ExportFiltros = {}): Promise<string> {
  const filas = await construirFilas(filtros);

  return BOM + [ENCABEZADOS, ...filas].map(escaparFila).join("\r\n");
}

function escaparFila(fila: readonly string[]): string {
  return fila.map(escaparCelda).join(SEPARADOR);
}

/**
 * A phone number is digits, but a name can carry a semicolon, a quote or a
 * newline. Anything that could break the row gets quoted, with inner quotes
 * doubled — the CSV convention Excel reads.
 */
function escaparCelda(valor: string): string {
  if (!/[";\r\n]/.test(valor)) return valor;
  return `"${valor.replace(/"/g, '""')}"`;
}

/** `2026-08-13T14:05:00.000Z` → `2026-08-13 09:05` in Bogotá time. */
function formatearFechaHora(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;

  const partes = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(fecha);

  const buscar = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? "";

  return `${buscar("year")}-${buscar("month")}-${buscar("day")} ${buscar("hour")}:${buscar("minute")}`;
}
