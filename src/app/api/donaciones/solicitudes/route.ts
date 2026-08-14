import { created } from "@/server/http/responses";
import { parseJsonBody, withRoute } from "@/server/http/route-handler";
import { crearSolicitudDonacionSchema } from "@/server/modules/donaciones/solicitudes.schema";
import { registrarSolicitudDonacion } from "@/server/modules/donaciones/solicitudes.service";

export const dynamic = "force-dynamic";

/** Registers a donor's selection of items for a center (mock — see the service). */
export const POST = withRoute(async (request) => {
  const input = await parseJsonBody(request, crearSolicitudDonacionSchema);
  return created(await registrarSolicitudDonacion(input));
});
