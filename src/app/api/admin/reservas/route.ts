import { ok } from "@/server/http/responses";
import { requireAdmin } from "@/server/http/auth";
import { parseSearchParams, withRoute } from "@/server/http/route-handler";
import { listarReservas } from "@/server/modules/reservas/reservas.admin.repository";
import { listarReservasSchema } from "@/server/modules/reservas/reservas.admin.schema";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (request) => {
  requireAdmin(request);

  const filtros = parseSearchParams(request, listarReservasSchema);
  return ok(await listarReservas(filtros));
});
