import { requireAdmin } from "@/server/http/auth";
import { ok } from "@/server/http/responses";
import { withRoute } from "@/server/http/route-handler";

export const dynamic = "force-dynamic";

/**
 * Who the caller is.
 *
 * The panel asks this on load to know whether to show the login form or the
 * dashboard. The cookie is `httpOnly`, so the browser cannot look at it — asking
 * the server is the only way for the page to find out, and it doubles as the
 * check that the session is still alive.
 */
export const GET = withRoute(async (request) => {
  const quien = await requireAdmin(request);

  return ok(
    quien.tipo === "usuario"
      ? { usuario: quien.usuario, nombre: quien.nombre }
      : { usuario: null, nombre: "Acceso por token" },
  );
});
