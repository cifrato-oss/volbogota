import { ok } from "@/server/http/responses";
import { withRoute } from "@/server/http/route-handler";
import { obtenerCentro } from "@/server/modules/catalogo/catalogo.service";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (_request, ctx: RouteContext<"/api/centros/[id]">) => {
  const { id } = await ctx.params;
  return ok(await obtenerCentro(id));
});
