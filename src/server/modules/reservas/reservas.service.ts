import { notFound } from "@/server/http/errors";
import { logger } from "@/server/lib/logger";
import { findCentroById } from "@/server/modules/catalogo/catalogo.repository";
import { ETIQUETA_JORNADA, HORARIOS } from "@/server/modules/catalogo/catalogo.schema";

import { crearReservaEnTransaccion } from "./reservas.repository";
import type { ConfirmacionReserva, CrearReservaInput } from "./reservas.schema";

/**
 * Registers a volunteer for a shift.
 *
 * Mirrors the validation the spreadsheet does in its `Validación` column —
 * shift exists, phone not already booked for that shift, consent given, adult —
 * plus the capacity check the `Turnos` sheet flags in red when it runs out.
 * Consent and age are enforced by the schema, so by the time we get here the
 * remaining rules are the ones that depend on stored state.
 */
export async function crearReserva(input: CrearReservaInput): Promise<ConfirmacionReserva> {
  const { reserva, turno } = await crearReservaEnTransaccion(input, async (centroId) => {
    const centro = await findCentroById(centroId);
    if (!centro || !centro.activo) {
      throw notFound("El centro de acopio no está disponible.");
    }
    return centro.actividades;
  });

  logger.info("Reserva creada", {
    reservaId: reserva.id,
    turnoId: turno.id,
    reservados: turno.reservados,
    cuposTotales: turno.cuposTotales,
  });

  return {
    codigo: reserva.codigo,
    estado: reserva.estado,
    nombre: reserva.nombre,
    turno: {
      id: turno.id,
      centroNombre: turno.centroNombre,
      fecha: turno.fecha,
      jornada: ETIQUETA_JORNADA[turno.jornada],
      horario: HORARIOS[turno.jornada].etiqueta,
    },
    actividad: reserva.actividad,
  };
}
