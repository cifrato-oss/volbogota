import { mostrarDatosDePrueba } from "@/lib/flags";
import { siNoDesdeSheet } from "@/server/modules/sheets/sheets.mapper";
import type { SincronizarBancosSangreInput } from "@/server/modules/sheets/sheets.schema";

import { resolverCoordenadas } from "./coordenadas";
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

  // Coordinates come from the Maps link a coordinator pasted, resolved here and
  // stored — the pin has to be the place they looked at, not a guess. Only links
  // that changed are resolved, so a sync of an unchanged sheet costs nothing.
  const yaGuardados = new Map((await findBancos(false)).map((banco) => [banco.id, banco] as const));

  const filas = await Promise.all(
    input.filas.map(async (fila) => {
      const id = idDeBanco(fila.bancoDeSangre);
      const previo = yaGuardados.get(id);
      const mismoLink = previo?.linkMaps === fila.linkMaps && previo?.lat != null;

      const punto = mismoLink
        ? { lat: previo!.lat!, lng: previo!.lng! }
        : await resolverCoordenadas(fila.linkMaps);

      return { fila, punto };
    }),
  );

  const bancos: BancoSangre[] = filas.map(({ fila, punto }) => ({
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
    lat: punto?.lat ?? null,
    lng: punto?.lng ?? null,
    actualizadoEn: ahora,
  }));

  await guardarBancosEnLote(bancos);

  const desactivados = await desactivarBancosAusentes(bancos.map((banco) => banco.id));

  return { bancos: bancos.length, desactivados };
}

/**
 * Every active blood bank, for the public listing.
 *
 * Seeded banks are dropped here as well as in the realtime hook, and both are
 * needed: this route is what paints the page before `onSnapshot` connects, so
 * filtering in only one of them would flash sixteen invented points and then
 * quietly replace them with three.
 */
export async function listarBancos(): Promise<BancoSangre[]> {
  const bancos = await findBancos(true);

  if (mostrarDatosDePrueba) return bancos;

  return bancos.filter((banco) => banco.esMock !== true);
}
