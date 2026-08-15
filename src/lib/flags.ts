/**
 * Client-side feature flags, read from `NEXT_PUBLIC_*` env.
 *
 * These are inlined by Next at build time, so flipping one needs a rebuild
 * (a redeploy), not just a restart.
 */

/**
 * Whether the "Quiero donar" page is interactive: tick items and submit a
 * donation intent (with the confirmation basket + "Hacer donación" button).
 *
 * Off by default — the page then only shows what each center needs, organized
 * by category (informative, read-only). Enable with
 * `NEXT_PUBLIC_DONAR_SELECCION=true`.
 */
export const donarSeleccionHabilitada = process.env.NEXT_PUBLIC_DONAR_SELECCION === "true";

/**
 * Whether seeded test data is visible.
 *
 * Off unless a deploy asks for it, and that default is the whole point: local
 * and staging share production's Firestore, so a blood bank invented to fill a
 * screen is one merge away from telling a real donor to travel to a point that
 * does not take donations. Opting in is a decision someone makes per
 * environment; opting out is never something they have to remember.
 *
 * Set `NEXT_PUBLIC_MOSTRAR_MOCK=true` in `.env.local` and in staging. Production
 * leaves it unset, so `pnpm run seed:sangre` is safe to run against prod.
 */
export const mostrarDatosDePrueba = process.env.NEXT_PUBLIC_MOSTRAR_MOCK === "true";
