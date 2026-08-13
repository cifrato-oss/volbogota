import { z } from "zod";

import { ok } from "@/server/http/responses";
import { parseSearchParams, withRoute } from "@/server/http/route-handler";
import { listarTurnos } from "@/server/modules/catalogo/catalogo.service";
import { fechaSchema, jornadaSchema } from "@/server/modules/catalogo/catalogo.schema";
import { asegurarCatalogo } from "@/server/modules/sheets/sheets.csv";

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
  const opciones = {
    centroId: centro,
    fecha,
    jornada,
    soloDisponibles: disponibles,
  };

  let turnos = await listarTurnos(opciones);

  await asegurarCatalogo(turnos.length > 0);
  if (turnos.length === 0) turnos = await listarTurnos(opciones);

  return ok(turnos);
});
