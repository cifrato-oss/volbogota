import { requireSheetsHook } from "@/server/http/auth";
import { ok } from "@/server/http/responses";
import { parseJsonBody, withRoute } from "@/server/http/route-handler";
import { sincronizarTurnosSchema } from "@/server/modules/sheets/sheets.schema";
import { sincronizarTurnosDesdeSheet } from "@/server/modules/sheets/sheets.service";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (request) => {
  requireSheetsHook(request);

  const input = await parseJsonBody(request, sincronizarTurnosSchema);

  return ok(await sincronizarTurnosDesdeSheet(input));
});
