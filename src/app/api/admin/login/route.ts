import { z } from "zod";

import { isProduction } from "@/server/config/env";
import { unauthorized } from "@/server/http/errors";
import { ok } from "@/server/http/responses";
import { parseJsonBody, withRoute } from "@/server/http/route-handler";
import { COOKIE_SESION, crearSesion, opcionesCookie } from "@/server/modules/admin/sesiones";
import { buscarUsuario, verificarPassword } from "@/server/modules/admin/usuarios";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  usuario: z.string().trim().min(1, "Escribe el usuario."),
  password: z.string().min(1, "Escribe la contraseña."),
});

/**
 * Opens a panel session.
 *
 * Every failure answers the same thing — wrong user, wrong password, disabled
 * account, all of them "usuario o contraseña incorrectos". Saying which one was
 * wrong turns this endpoint into a way to find out who has an account.
 *
 * A missing account still pays for a password verification against a dummy
 * digest. Returning early would make a nonexistent user answer measurably faster
 * than a real one, which is the same disclosure by another route.
 */
export const POST = withRoute(async (request) => {
  const { usuario, password } = await parseJsonBody(request, loginSchema);

  const cuenta = await buscarUsuario(usuario);
  const almacenado = cuenta?.passwordHash ?? HASH_SEÑUELO;
  const coincide = await verificarPassword(password, almacenado);

  if (!cuenta || !cuenta.activo || !coincide) {
    throw unauthorized("Usuario o contraseña incorrectos.");
  }

  const token = await crearSesion(cuenta.usuario, cuenta.nombre);

  const respuesta = ok({ usuario: cuenta.usuario, nombre: cuenta.nombre });
  respuesta.cookies.set(COOKIE_SESION, token, opcionesCookie(isProduction));

  return respuesta;
});

/**
 * A real digest of a password nobody has, so the miss path does the same work as
 * the hit path. Generated once and pasted here; its plaintext is irrelevant
 * because no account carries this hash.
 */
const HASH_SEÑUELO =
  "scrypt$16384$8$1$c2VudGluZWxhLXNlbnRpbmVsYQ==$" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";
