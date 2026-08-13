import { requireSheetsHook } from "@/server/http/auth";
import { ok } from "@/server/http/responses";
import { parseJsonBody, withRoute } from "@/server/http/route-handler";
import { sincronizarCentrosSchema } from "@/server/modules/sheets/sheets.schema";
import { sincronizarCentrosDesdeSheet } from "@/server/modules/sheets/sheets.service";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (request) => {
  requireSheetsHook(request);

  const input = await parseJsonBody(request, sincronizarCentrosSchema);

  return ok(await sincronizarCentrosDesdeSheet(input));
});
