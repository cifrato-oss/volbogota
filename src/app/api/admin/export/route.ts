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
  formato: z.enum(["csv", "xlsx"]).default("csv"),
});

const TIPOS = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

export const GET = withRoute(async (request) => {
  await requireAdmin(request);

  const { formato, ...filtros } = parseSearchParams(request, filtrosSchema);
  const sufijo = filtros.fecha ?? fechaActualBogota();

  /**
   * The workbook module is imported only when asked for.
   *
   * `exceljs` is heavy and this backend runs with `minInstances: 0`, so a static
   * import would put it in the cold start of every request — including the ones
   * that never touch it. CSV stays the default for the same reason.
   */
  const cuerpo =
    formato === "xlsx"
      ? await (
          await import("@/server/modules/admin/export-xlsx.service")
        ).exportarReservasXlsx(filtros)
      : await exportarReservasCsv(filtros);

  // Unlike every other endpoint this one answers with a file, not the JSON
  // envelope: the browser has to be able to save it straight to disk.
  return new Response(cuerpo as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": TIPOS[formato],
      "Content-Disposition": `attachment; filename="reservas-volbogota-${sufijo}.${formato}"`,
      "Cache-Control": "no-store",
    },
  });
});
