/**
 * Creates or updates a panel account.
 *
 *   pnpm run admin:crear-usuario -- --usuario juan --nombre "Juan Bernal" --password "…"
 *   pnpm run admin:crear-usuario -- --usuario juan --password "…" --forzar
 *
 * The document id is the username, lowercased, which is what makes a login a
 * direct read instead of a query.
 *
 * An existing account is not overwritten without `--forzar`. A silent overwrite
 * would be a password reset nobody asked for, and the person holding the old one
 * would find out at a centre's door.
 *
 * The password reaches this through the shell, so it lands in history. Prefix the
 * command with a space if the shell is set to skip those, or run `history -d`
 * after. `pnpm run admin:hash` exists for the same job without the write, when
 * the document is created by hand in the console.
 */

import { COLLECTIONS, getDb } from "@/server/db/firestore";
import { env } from "@/server/config/env";
import { hashPassword } from "@/server/modules/admin/usuarios";

function leerArg(nombre: string): string | undefined {
  const indice = process.argv.indexOf(`--${nombre}`);
  return indice === -1 ? undefined : process.argv[indice + 1];
}

async function main(): Promise<void> {
  const usuario = leerArg("usuario")?.trim().toLowerCase();
  const password = leerArg("password");
  const nombre = leerArg("nombre");
  const forzar = process.argv.includes("--forzar");

  if (!usuario || !password) {
    console.error(
      'Uso: pnpm run admin:crear-usuario -- --usuario juan --nombre "Juan Bernal" --password "…"',
    );
    process.exit(1);
  }

  if (password.length < 12) {
    console.error(
      `La contraseña tiene ${password.length} caracteres. Usa al menos 12: este panel abre ` +
        "nombres, celulares y edades de voluntarios.",
    );
    process.exit(1);
  }

  const destino = process.env.FIRESTORE_EMULATOR_HOST
    ? `emulador (${process.env.FIRESTORE_EMULATOR_HOST})`
    : `proyecto real (${env.firebase.projectId || "sin project id"})`;

  console.log(`Conectando a: ${destino}\n`);

  const ref = getDb().collection(COLLECTIONS.usuarios).doc(usuario);
  const existente = await ref.get();

  if (existente.exists && !forzar) {
    console.error(
      `Ya existe la cuenta '${usuario}'. Repite con --forzar para cambiarle la contraseña.`,
    );
    process.exit(1);
  }

  await ref.set(
    {
      nombre: nombre ?? existente.data()?.nombre ?? usuario,
      passwordHash: await hashPassword(password),
      activo: true,
      creadoEn: existente.data()?.creadoEn ?? Date.now(),
      actualizadoEn: Date.now(),
    },
    { merge: true },
  );

  console.log(
    existente.exists
      ? `✓ Contraseña actualizada para '${usuario}'.`
      : `✓ Cuenta '${usuario}' creada. Entra en /admin con ese usuario.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
