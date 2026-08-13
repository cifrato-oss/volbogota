import { created } from "@/server/http/responses";
import { parseJsonBody, withRoute } from "@/server/http/route-handler";
import { crearReservaSchema } from "@/server/modules/reservas/reservas.schema";
import { crearReserva } from "@/server/modules/reservas/reservas.service";

export const dynamic = "force-dynamic";

export const POST = withRoute(async (request) => {
  const input = await parseJsonBody(request, crearReservaSchema);
  return created(await crearReserva(input));
});
