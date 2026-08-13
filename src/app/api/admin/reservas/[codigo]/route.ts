import { ok } from "@/server/http/responses";
import { requireAdmin } from "@/server/http/auth";
import { parseJsonBody, withRoute } from "@/server/http/route-handler";
import { notFound } from "@/server/http/errors";
import {
  buscarReservaPorCodigo,
  cambiarEstado,
} from "@/server/modules/reservas/reservas.admin.repository";
import { cambiarEstadoSchema } from "@/server/modules/reservas/reservas.admin.schema";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (request, ctx: RouteContext<"/api/admin/reservas/[codigo]">) => {
  await requireAdmin(request);

  const { codigo } = await ctx.params;
  const reserva = await buscarReservaPorCodigo(codigo);
  if (!reserva) throw notFound("La reserva no existe.");

  return ok(reserva);
});

export const PATCH = withRoute(
  async (request, ctx: RouteContext<"/api/admin/reservas/[codigo]">) => {
    await requireAdmin(request);

    const { codigo } = await ctx.params;
    const { estado } = await parseJsonBody(request, cambiarEstadoSchema);

    return ok(await cambiarEstado(codigo, estado));
  },
);
