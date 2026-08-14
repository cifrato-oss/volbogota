import { z } from "zod";

import { ok } from "@/server/http/responses";
import { parseSearchParams, withRoute } from "@/server/http/route-handler";
import { hayNecesidades } from "@/server/modules/donaciones/donaciones.repository";
import { categoriaDonacionSchema } from "@/server/modules/donaciones/donaciones.schema";
import { listarNecesidadesDeCentro } from "@/server/modules/donaciones/donaciones.service";
import { asegurarNecesidades } from "@/server/modules/sheets/sheets.csv";

export const dynamic = "force-dynamic";

const filtrosSchema = z.object({
  centro: z.string().min(1, "El parámetro 'centro' es obligatorio."),
  categoria: categoriaDonacionSchema.optional(),
});

export const GET = withRoute(async (request) => {
  const { centro, categoria } = parseSearchParams(request, filtrosSchema);

  // Un backend recién arrancado no tiene ninguna necesidad sincronizada todavía.
  // Antes que dejar que todo caiga en el valor por defecto, se lee la hoja.
  await asegurarNecesidades(await hayNecesidades());

  return ok(await listarNecesidadesDeCentro(centro, { categoria }));
});
