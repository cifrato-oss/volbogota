import { siNoDesdeSheet } from "@/server/modules/sheets/sheets.mapper";
import type { SincronizarBancosSangreInput } from "@/server/modules/sheets/sheets.schema";

import { desactivarBancosAusentes, findBancos, guardarBancosEnLote } from "./sangre.repository";
import { idDeBanco, parsearTipos, type BancoSangre } from "./sangre.schema";

/**
 * Applies the `Banco de Sangre` sheet to Firestore.
 *
 * Every synced row gets a fresh `actualizadoEn`, and that is the point of this
 * module rather than a detail: the front derives "sin reporte hoy" from that
 * timestamp not being today. So a coordinator who opens the sheet and confirms
 * the list without changing a cell still needs the write to land — the value
 * did not change, but the fact that someone looked at it did, and that is what
 * a donor is actually being told.
 */
export async function sincronizarBancosDesdeSheet(input: SincronizarBancosSangreInput): Promise<{
  bancos: number;
  desactivados: number;
}> {
  const ahora = new Date().toISOString();

  const bancos: BancoSangre[] = input.filas.map((fila) => ({
    id: idDeBanco(fila.bancoDeSangre),
    nombre: fila.bancoDeSangre.trim(),
    direccion: fila.direccion,
    localidad: fila.localidad,
    horarioOficial: fila.horarioOficial,
    linkMaps: fila.linkMaps,
    tiposQueRecibe: parsearTipos(fila.tipoDeSangre),
    resumenTipos: fila.tipoDeSangre?.trim() || null,
    // Defaults to receiving: a blank cell on a row someone bothered to keep is
    // likelier to be an unfilled dropdown than a closed bank, and turning a
    // donor away is the costlier mistake.
    recibiendoHoy: siNoDesdeSheet(fila.recibiendoHoy ?? "Sí"),
    // An empty `Activo` means the bank is operating: the column exists to retire
    // one, not to enable each. Same reading as `Centros`.
    activo: siNoDesdeSheet(fila.activo ?? "Sí"),
    actualizadoEn: ahora,
  }));

  await guardarBancosEnLote(bancos);

  const desactivados = await desactivarBancosAusentes(bancos.map((banco) => banco.id));

  return { bancos: bancos.length, desactivados };
}

/** Every active blood bank, for the public listing. */
export async function listarBancos(): Promise<BancoSangre[]> {
  return findBancos(true);
}
