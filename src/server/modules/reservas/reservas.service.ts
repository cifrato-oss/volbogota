import { notFound } from "@/server/http/errors";
import { logger } from "@/server/lib/logger";
import { findCentroById } from "@/server/modules/catalogo/catalogo.repository";
import { ETIQUETA_JORNADA, HORARIOS } from "@/server/modules/catalogo/catalogo.schema";

import { buscarReservaPorCodigo, cambiarEstado, registrarHora } from "./reservas.admin.repository";
import { crearReservaEnTransaccion } from "./reservas.repository";
import type {
  ConfirmacionReserva,
  CrearReservaInput,
  EstadoReserva,
  Reserva,
} from "./reservas.schema";

/**
 * Registers a volunteer for a shift.
 *
 * Mirrors the validation the spreadsheet does in its `Validación` column —
 * shift exists, phone not already booked for that shift, consent given, old
 * enough — plus the capacity check the `Turnos` sheet flags in red when it runs
 * out. Consent and age are enforced by the schema, so by the time we get here
 * the remaining rules are the ones that depend on stored state.
 */
export async function crearReserva(input: CrearReservaInput): Promise<ConfirmacionReserva> {
  const { reserva, turno } = await crearReservaEnTransaccion(input);

  // Fetched after the booking is safely committed: the confirmation tells the
  // volunteer where to show up, and getting the address wrong is worse than
  // spending one extra read on it.
  const centro = await findCentroById(turno.centroId);

  logger.info("Reserva creada", {
    reservaId: reserva.id,
    turnoId: turno.id,
    reservados: turno.reservados,
    cuposTotales: turno.cuposTotales,
  });

  return {
    codigo: reserva.codigo,
    estado: reserva.estado,
    nombre: `${reserva.nombre} ${reserva.apellido}`,
    turno: {
      id: turno.id,
      centroNombre: turno.centroNombre,
      fecha: turno.fecha,
      jornada: ETIQUETA_JORNADA[turno.jornada],
      horario: HORARIOS[turno.jornada].etiqueta,
      direccion: centro?.direccion ?? null,
      horarioOficial: centro?.horarioOficial ?? null,
    },
  };
}

/** Kept exported for the admin panel, which still resolves centres by id. */
export async function obtenerCentroDeReserva(centroId: string) {
  const centro = await findCentroById(centroId);
  if (!centro) throw notFound("El centro de acopio no existe.");
  return centro;
}

/**
 * Public entry points for callers outside this module — today the spreadsheet
 * sync. They wrap the admin repository so a neighbouring module never has to
 * reach into it directly.
 */

/** Null rather than throwing: the sync uses it to decide create vs. update. */
export async function encontrarReserva(codigo: string): Promise<Reserva | null> {
  return buscarReservaPorCodigo(codigo);
}

export async function actualizarEstadoReserva(
  codigo: string,
  estado: EstadoReserva,
): Promise<Reserva> {
  return cambiarEstado(codigo, estado);
}

export async function registrarHoraReserva(
  codigo: string,
  campo: "checkIn" | "checkOut",
  hora: string,
): Promise<Reserva> {
  return registrarHora(codigo, campo, hora);
}
