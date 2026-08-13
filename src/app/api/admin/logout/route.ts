import { isProduction } from "@/server/config/env";
import { ok } from "@/server/http/responses";
import { withRoute } from "@/server/http/route-handler";
import { borrarSesion, COOKIE_SESION, opcionesCookie } from "@/server/modules/admin/sesiones";

export const dynamic = "force-dynamic";

/**
 * Closes the session.
 *
 * The document is deleted, not just the cookie: clearing the cookie only asks
 * the browser to forget the token, and a copy taken from it would keep working
 * for the remaining eight hours. Deleting server-side is what actually revokes.
 *
 * No auth guard on purpose. Logging out is not a privileged action, and an
 * expired or already-deleted session answering 401 here would leave the cookie
 * stuck in the browser.
 */
export const POST = withRoute(async (request) => {
  await borrarSesion(request.cookies.get(COOKIE_SESION)?.value);

  const respuesta = ok({ cerrada: true });
  respuesta.cookies.set(COOKIE_SESION, "", { ...opcionesCookie(isProduction), maxAge: 0 });

  return respuesta;
});
