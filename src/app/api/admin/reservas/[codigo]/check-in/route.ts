import { ok } from "@/server/http/responses";
import { requireAdmin } from "@/server/http/auth";
import { parseJsonBody, withRoute } from "@/server/http/route-handler";
import { registrarHora } from "@/server/modules/reservas/reservas.admin.repository";
import { registrarHoraSchema } from "@/server/modules/reservas/reservas.admin.schema";
import { horaActualBogota } from "@/server/lib/hora";

export const dynamic = "force-dynamic";

export const POST = withRoute(
  async (request, ctx: RouteContext<"/api/admin/reservas/[codigo]/check-in">) => {
    requireAdmin(request);

    const { codigo } = await ctx.params;
    const { hora } = await parseJsonBody(request, registrarHoraSchema);

    return ok(await registrarHora(codigo, "checkIn", hora ?? horaActualBogota()));
  },
);
