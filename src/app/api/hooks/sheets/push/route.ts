import { requireAdmin } from "@/server/http/auth";
import { ok } from "@/server/http/responses";
import { parseSearchParams, withRoute } from "@/server/http/route-handler";
import { listarReservas } from "@/server/modules/reservas/reservas.admin.repository";
import { listarReservasSchema } from "@/server/modules/reservas/reservas.admin.schema";
import { empujarReservasAlSheet, exigirReservas } from "@/server/modules/sheets/sheets.outbound";

export const dynamic = "force-dynamic";

/**
 * Re-sends reservations to the spreadsheet.
 *
 * The safety net for the automatic push: it runs on the booking path and is
 * built to give up rather than delay a volunteer, so anything lost while the
 * script was down or slow is recovered from here. Takes the same filters as the
 * admin listing, so a coordinator can repair one shift instead of everything.
 *
 * Behind the admin token, not the sheet's: this reads volunteers' personal data
 * out of the database, which is exactly what that token protects.
 */
export const POST = withRoute(async (request) => {
  await requireAdmin(request);

  const filtros = parseSearchParams(request, listarReservasSchema);
  const { reservas } = await listarReservas(filtros);

  exigirReservas(reservas);

  const resultado = await empujarReservasAlSheet(reservas);

  return ok({ ...resultado, encontradas: reservas.length });
});
