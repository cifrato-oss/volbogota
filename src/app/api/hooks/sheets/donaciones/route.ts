import { requireSheetsHook } from "@/server/http/auth";
import { ok } from "@/server/http/responses";
import { parseJsonBody, withRoute } from "@/server/http/route-handler";
import { sincronizarDonacionesSchema } from "@/server/modules/sheets/sheets.schema";
import { sincronizarDonacionesDesdeSheet } from "@/server/modules/sheets/sheets.service";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (request) => {
  requireSheetsHook(request);

  const input = await parseJsonBody(request, sincronizarDonacionesSchema);

  return ok(await sincronizarDonacionesDesdeSheet(input));
});
