import { ok } from "@/server/http/responses";
import { requireAdmin } from "@/server/http/auth";
import { withRoute } from "@/server/http/route-handler";
import { obtenerResumen } from "@/server/modules/admin/resumen.service";

export const dynamic = "force-dynamic";

export const GET = withRoute(async (request) => {
  await requireAdmin(request);
  return ok(await obtenerResumen());
});
