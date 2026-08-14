import type {
  CrearSolicitudDonacionInput,
  SolicitudDonacionConfirmacion,
} from "./solicitudes.schema";

/**
 * Registers a donation intent and hands back a reference code.
 *
 * MOCK: this does not persist anything yet. It validates upstream (the route
 * parses with `crearSolicitudDonacionSchema`) and returns a plausible
 * confirmation so the "Quiero donar" flow can be built and demoed end to end.
 * When the real backing store lands, replace the body with a repository write
 * and keep this signature.
 */
export async function registrarSolicitudDonacion(
  input: CrearSolicitudDonacionInput,
): Promise<SolicitudDonacionConfirmacion> {
  // Stand in for the write round trip so the client's pending state is visible.
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    codigo: `DON-${generarCodigo()}`,
    centroId: input.centroId,
    totalItems: input.items.length,
    recibidoEn: new Date().toISOString(),
  };
}

// Crockford-ish alphabet: no 0/O/1/I/L, so codes are easy to read aloud.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generarCodigo(longitud = 6): string {
  let codigo = "";
  for (let i = 0; i < longitud; i += 1) {
    codigo += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return codigo;
}
