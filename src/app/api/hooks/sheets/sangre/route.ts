import { requireSheetsHook } from "@/server/http/auth";
import { ok } from "@/server/http/responses";
import { parseJsonBody, withRoute } from "@/server/http/route-handler";
import { sincronizarBancosDesdeSheet } from "@/server/modules/sangre/sangre.service";
import { sincronizarBancosSangreSchema } from "@/server/modules/sheets/sheets.schema";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (request) => {
  requireSheetsHook(request);

  const input = await parseJsonBody(request, sincronizarBancosSangreSchema);

  return ok(await sincronizarBancosDesdeSheet(input));
});
