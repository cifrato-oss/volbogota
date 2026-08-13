/**
 * Produces the `passwordHash` field for a panel account.
 *
 * Accounts are created by hand in the Firestore console, and a scrypt digest is
 * not something a human can type. This prints the value to paste.
 *
 *   pnpm run admin:hash -- "la contraseña"
 *
 * The password is read from the argument rather than prompted because that is
 * what a coordinator setting up an account will actually do. It lands in the
 * shell history — run `history -d` after, or prefix the command with a space if
 * the shell is configured to skip those.
 *
 * The document goes in `usuarios`, and **its id is the username**, lowercase:
 *
 *   usuarios/coordinador
 *     nombre        "Nombre que se muestra en el panel"
 *     passwordHash  "scrypt$16384$8$1$…"
 *     activo        true
 */

import { hashPassword } from "@/server/modules/admin/usuarios";

async function main(): Promise<void> {
  const password = process.argv.slice(2).find((arg) => arg !== "--");

  if (!password) {
    console.error('Falta la contraseña.  Uso: pnpm run admin:hash -- "la contraseña"');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error(
      `La contraseña tiene ${password.length} caracteres. Usa al menos 12: este panel abre ` +
        "nombres, celulares y edades de voluntarios, y una contraseña corta se adivina sola.",
    );
    process.exit(1);
  }

  console.log(await hashPassword(password));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
