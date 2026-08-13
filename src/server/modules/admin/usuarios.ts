import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

import { COLLECTIONS, getDb } from "@/server/db/firestore";

/**
 * Panel accounts, stored in Firestore.
 *
 * The password never touches the database. What is stored is a scrypt digest
 * with its own random salt, in a self-describing string:
 *
 *   scrypt$16384$8$1$<salt en base64>$<digest en base64>
 *
 * Carrying the cost parameters inside the value is what makes them changeable:
 * raising N later keeps every existing password verifiable, because each digest
 * says how it was produced. A bare hash would force everyone to reset.
 *
 * scrypt and not SHA: a coordinator's password is short and human, and a plain
 * hash of it falls to a dictionary in minutes. scrypt is deliberately slow and
 * memory-hard, so the same dictionary costs weeks. Node ships it, so this adds
 * no dependency.
 *
 * Accounts are created by hand for now — see `hashPassword`, which exists so a
 * human can produce the field and paste it into the console.
 */

/**
 * `promisify` collapses scrypt's overloads and loses the one that takes options,
 * so the signature is restated here. Without it the cost parameters cannot be
 * passed and every digest would silently use Node's defaults.
 */
const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: ScryptOptions,
) => Promise<Buffer>;

/** Cost parameters. N is the expensive one; 16384 keeps a login near 100ms. */
const N = 16_384;
const R = 8;
const P = 1;
const LARGO = 64;
const SAL_BYTES = 16;

export type Usuario = {
  usuario: string;
  nombre: string;
  activo: boolean;
};

/** Produces the value that goes in the document's `passwordHash` field. */
export async function hashPassword(password: string): Promise<string> {
  const sal = randomBytes(SAL_BYTES);
  const digest = (await scrypt(password.normalize("NFKC"), sal, LARGO, {
    N,
    r: R,
    p: P,
  })) as Buffer;

  return ["scrypt", N, R, P, sal.toString("base64"), digest.toString("base64")].join("$");
}

/**
 * Whether a password matches a stored digest.
 *
 * Returns false instead of throwing on a malformed stored value: a hand-written
 * document with a typo in the hash is a wrong password, not a 500 that tells an
 * attacker they found a real account.
 */
export async function verificarPassword(password: string, almacenado: string): Promise<boolean> {
  const partes = almacenado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;

  const [, nTexto, rTexto, pTexto, salB64, digestB64] = partes;

  // `noUncheckedIndexedAccess` types these as possibly undefined even after the
  // length check, and that is the honest reading: a hand-written value can be
  // "scrypt$$$$$" and satisfy the split without carrying anything.
  if (!nTexto || !rTexto || !pTexto || !salB64 || !digestB64) return false;

  const n = Number(nTexto);
  const r = Number(rTexto);
  const p = Number(pTexto);

  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const esperado = Buffer.from(digestB64, "base64");
  if (esperado.length === 0) return false;

  const calculado = (await scrypt(
    password.normalize("NFKC"),
    Buffer.from(salB64, "base64"),
    esperado.length,
    {
      N: n,
      r,
      p,
      // Node caps scrypt's memory at 32MB by default and N=16384 with r=8 needs
      // more than that. Without this the call throws instead of verifying.
      maxmem: 256 * 1024 * 1024,
    },
  )) as Buffer;

  return timingSafeEqual(calculado, esperado);
}

/**
 * Finds an account by username.
 *
 * The document id is the username, lowercased, so this is a direct read: no
 * query, no composite index, and no way for a lookup to become a scan as the
 * collection grows.
 */
export async function buscarUsuario(
  usuario: string,
): Promise<(Usuario & { passwordHash: string }) | null> {
  const id = usuario.trim().toLowerCase();
  if (!id) return null;

  const doc = await getDb().collection(COLLECTIONS.usuarios).doc(id).get();
  if (!doc.exists) return null;

  const datos = doc.data() ?? {};
  const passwordHash = typeof datos.passwordHash === "string" ? datos.passwordHash : "";

  if (!passwordHash) return null;

  return {
    usuario: id,
    nombre: typeof datos.nombre === "string" && datos.nombre ? datos.nombre : id,
    // A document written by hand may simply omit the field; an account is only
    // disabled when it says so.
    activo: datos.activo !== false,
    passwordHash,
  };
}
