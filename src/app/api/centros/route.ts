import { ok } from "@/server/http/responses";
import { withRoute } from "@/server/http/route-handler";
import { listarCentros } from "@/server/modules/catalogo/catalogo.service";

export const dynamic = "force-dynamic";

export const GET = withRoute(async () => ok(await listarCentros()));
