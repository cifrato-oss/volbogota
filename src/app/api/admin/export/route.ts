import { z } from "zod";

import { requireAdmin } from "@/server/http/auth";
import { parseSearchParams, withRoute } from "@/server/http/route-handler";
import { exportarReservasCsv } from "@/server/modules/admin/export.service";
import { fechaActualBogota } from "@/server/lib/hora";
import { fechaSchema } from "@/server/modules/catalogo/catalogo.schema";

export const dynamic = "force-dynamic";

const filtrosSchema = z.object({
  fecha: fechaSchema.optional(),
  centro: z.string().min(1).optional(),
});

export const GET = withRoute(async (request) => {
  requireAdmin(request);

  const filtros = parseSearchParams(request, filtrosSchema);
  const csv = await exportarReservasCsv(filtros);

  const sufijo = filtros.fecha ?? fechaActualBogota();

  // Unlike every other endpoint this one answers with a file, not the JSON
  // envelope: the browser has to be able to save it straight to disk.
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reservas-volbogota-${sufijo}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
