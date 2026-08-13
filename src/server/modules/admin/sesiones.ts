import { createHash, randomBytes } from "node:crypto";

import { COLLECTIONS, getDb } from "@/server/db/firestore";

/**
 * Panel sessions.
 *
 * The cookie carries an opaque random token and nothing else — no username, no
 * signature, no expiry the browser could edit. Everything that matters lives in
 * Firestore, which is what makes a session revocable: deleting the document logs
 * that browser out on its next request. A signed cookie could not do that
 * without a blocklist, which is the same read this already pays.
 *
 * What is stored is the token's SHA-256, not the token. A dump of this
 * collection is then useless for impersonation, the same reason password hashes
 * exist. SHA-256 and not scrypt here on purpose: the token is 32 random bytes,
 * so there is no dictionary to slow down, and a login should not pay twice.
 */

export const COOKIE_SESION = "volbogota_sesion";

/** Eight hours: longer than a shift, shorter than a weekend. */
const DURACION_MS = 8 * 60 * 60 * 1000;

export type Sesion = { usuario: string; nombre: string };

function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function crearSesion(usuario: string, nombre: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const ahora = Date.now();

  await getDb()
    .collection(COLLECTIONS.sesiones)
    .doc(digest(token))
    .set({ usuario, nombre, creadaEn: ahora, expiraEn: ahora + DURACION_MS });

  return token;
}

/**
 * Resolves a cookie token to its session, or null.
 *
 * An expired session is deleted on the way out rather than left to accumulate:
 * nobody is going to run a cleanup job for this, and the read that noticed the
 * expiry is already paid for.
 */
export async function leerSesion(token: string | undefined): Promise<Sesion | null> {
  if (!token) return null;

  const ref = getDb().collection(COLLECTIONS.sesiones).doc(digest(token));
  const doc = await ref.get();

  if (!doc.exists) return null;

  const datos = doc.data() ?? {};
  const expiraEn = Number(datos.expiraEn);

  if (!Number.isFinite(expiraEn) || expiraEn <= Date.now()) {
    await ref.delete().catch(() => {});
    return null;
  }

  return {
    usuario: String(datos.usuario ?? ""),
    nombre: String(datos.nombre ?? datos.usuario ?? ""),
  };
}

export async function borrarSesion(token: string | undefined): Promise<void> {
  if (!token) return;
  await getDb().collection(COLLECTIONS.sesiones).doc(digest(token)).delete();
}

/** The cookie's attributes, in one place so login and logout cannot disagree. */
export function opcionesCookie(seguro: boolean) {
  return {
    httpOnly: true,
    // Not readable from JavaScript, so an XSS on the panel cannot steal it —
    // which is the whole reason this is a cookie and not `sessionStorage`.
    sameSite: "lax" as const,
    secure: seguro,
    path: "/",
    maxAge: DURACION_MS / 1000,
  };
}
