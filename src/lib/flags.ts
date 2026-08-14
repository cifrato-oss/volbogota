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
