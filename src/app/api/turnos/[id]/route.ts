import { ok } from "@/server/http/responses";
import { withRoute } from "@/server/http/route-handler";
import { obtenerTurno } from "@/server/modules/catalogo/catalogo.service";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_request, ctx: RouteContext<"/api/turnos/[id]">) => {
  const { id } = await ctx.params;
  return ok(await obtenerTurno(id));
});
