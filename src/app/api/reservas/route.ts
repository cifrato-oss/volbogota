import { created } from "@/server/http/responses";
import { parseJsonBody, withRoute } from "@/server/http/route-handler";
import { crearReservaSchema } from "@/server/modules/reservas/reservas.schema";
import { crearReserva, encontrarReserva } from "@/server/modules/reservas/reservas.service";
import {
  notificarReservaAlSheet,
  notificarTurnoAlSheet,
} from "@/server/modules/sheets/sheets.outbound";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (request) => {
  const input = await parseJsonBody(request, crearReservaSchema);
  const confirmacion = await crearReserva(input);

  // After the booking is committed, and unable to fail it: the volunteer has
  // their code either way, and `/api/hooks/sheets/push` resends what did not
  // land. The push lives here rather than in the service so the reservations
  // module stays unaware of the spreadsheet.
  const reserva = await encontrarReserva(confirmacion.codigo);
  if (reserva) {
    await notificarReservaAlSheet(reserva);
    await notificarTurnoAlSheet(reserva.turnoId);
  }

  return created(confirmacion);
});
