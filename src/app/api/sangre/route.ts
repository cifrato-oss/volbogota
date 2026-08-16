import { ok } from "@/server/http/responses";
import { withRoute } from "@/server/http/route-handler";
import { listarBancos } from "@/server/modules/sangre/sangre.service";

export const dynamic = "force-dynamic";

/**
 * The blood banks, for the first paint and for browsers where the realtime
 * client cannot start. The live path is `onSnapshot` straight from Firestore —
 * this exists so the page is never blank while that connects.
 *
 * It returns every bank with every type it accepts. Filtering by the donor's own
 * type happens in the browser and only there: a blood type is sensitive health
 * data, and putting it in a query string would write it into request logs.
 */
export const GET = withRoute(async () => ok(await listarBancos()));
