import { z } from "zod";

import { ok } from "@/server/http/responses";
import { parseSearchParams, withRoute } from "@/server/http/route-handler";
import { listarTurnos } from "@/server/modules/catalogo/catalogo.service";
import { fechaSchema, jornadaSchema } from "@/server/modules/catalogo/catalogo.schema";

export const dynamic = "force-dynamic";

const filtrosSchema = z.object({
  centro: z.string().min(1).optional(),
  fecha: fechaSchema.optional(),
  jornada: jornadaSchema.optional(),
  disponibles: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const GET = withRoute(async (request) => {
  const { centro, fecha, jornada, disponibles } = parseSearchParams(request, filtrosSchema);

  return ok(
    await listarTurnos({
      centroId: centro,
      fecha,
      jornada,
      soloDisponibles: disponibles,
    }),
  );
});
