import { z } from "zod";

import { requireAdmin } from "@/server/http/auth";
import { ok } from "@/server/http/responses";
import { parseJsonBody, withRoute } from "@/server/http/route-handler";
import { registrarAsistencia } from "@/server/modules/reservas/reservas.admin.repository";
import { asistenciaSchema } from "@/server/modules/reservas/reservas.schema";

export const dynamic = "force-dynamic";

const marcarAsistenciaSchema = z.object({ asistencia: asistenciaSchema });

/**
 * Marks whether a volunteer turned up.
 *
 * Replaces the check-in and check-out endpoints: the sheet dropped those
 * columns for a single `Asistencia`, and attendance is an observation, not a
 * pair of timestamps to subtract.
 */
export const POST = withRoute(
  async (request, ctx: RouteContext<"/api/admin/reservas/[codigo]/asistencia">) => {
    await requireAdmin(request);

    const { codigo } = await ctx.params;
    const { asistencia } = await parseJsonBody(request, marcarAsistenciaSchema);

    return ok(await registrarAsistencia(codigo, asistencia));
  },
);
