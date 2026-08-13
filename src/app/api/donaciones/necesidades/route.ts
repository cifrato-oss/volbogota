import { z } from "zod";

import { ok } from "@/server/http/responses";
import { parseSearchParams, withRoute } from "@/server/http/route-handler";
import { categoriaDonacionSchema } from "@/server/modules/donaciones/donaciones.schema";
import { listarNecesidadesDeCentro } from "@/server/modules/donaciones/donaciones.service";

export const dynamic = "force-dynamic";

const filtrosSchema = z.object({
  centro: z.string().min(1, "El parámetro 'centro' es obligatorio."),
  categoria: categoriaDonacionSchema.optional(),
});

export const GET = withRoute(async (request) => {
  const { centro, categoria } = parseSearchParams(request, filtrosSchema);

  return ok(await listarNecesidadesDeCentro(centro, { categoria }));
});
