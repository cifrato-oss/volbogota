import { requireSheetsHook } from "@/server/http/auth";
import { ok } from "@/server/http/responses";
import { parseJsonBody, withRoute } from "@/server/http/route-handler";
import { sincronizarReservasSchema } from "@/server/modules/sheets/sheets.schema";
import { sincronizarReservasDesdeSheet } from "@/server/modules/sheets/sheets.service";

export const dynamic = "force-dynamic";

/**
 * Answers 200 even when rows failed: the verdict travels per row so Apps Script
 * can write each one back into its `Validación` cell. A non-2xx would tell the
 * script the whole batch was lost, which is not what happened.
 */
export const POST = withRoute(async (request) => {
  requireSheetsHook(request);

  const input = await parseJsonBody(request, sincronizarReservasSchema);

  return ok(await sincronizarReservasDesdeSheet(input));
});
