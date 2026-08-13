import { z } from "zod";

import { requireAdmin } from "@/server/http/auth";
import { ok } from "@/server/http/responses";
import { parseJsonBody, withRoute } from "@/server/http/route-handler";
import { estadoNecesidadSchema } from "@/server/modules/donaciones/donaciones.schema";
import { actualizarEstadoNecesidad } from "@/server/modules/donaciones/donaciones.service";

export const dynamic = "force-dynamic";

const cambiarEstadoSchema = z.object({ estado: estadoNecesidadSchema });

export const PATCH = withRoute(
  async (request, ctx: RouteContext<"/api/admin/necesidades/[id]">) => {
    requireAdmin(request);

    const { id } = await ctx.params;
    const { estado } = await parseJsonBody(request, cambiarEstadoSchema);

    return ok(await actualizarEstadoNecesidad(id, estado));
  },
);
