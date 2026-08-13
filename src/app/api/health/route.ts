import { ok } from "@/server/http/responses";
import { withRoute } from "@/server/http/route-handler";
import { getHealthStatus } from "@/server/modules/health/health.service";

// Always answer with a fresh reading; a cached health check is useless.
export const dynamic = "force-dynamic";

export const GET = withRoute(async () => ok(getHealthStatus()));
