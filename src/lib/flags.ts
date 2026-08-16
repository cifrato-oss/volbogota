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

/**
 * Whether `/sangre` lists the individual banks instead of the two directories.
 *
 * Off: the page shows the Cruz Roja and the Banco Distrital, and a donor books
 * with whichever they pick. On: the live list returns — every bank with the
 * types it is taking today, kept current from the spreadsheet, with the type
 * picker, the locality filter and the map.
 *
 * That whole flow is still here, tested and wired to the sheet. It is behind a
 * flag rather than deleted because what changed was not the code but who
 * maintains the answer: sending donors to each organisation's own page means the
 * hours and requirements they read are kept current by the people who own them,
 * with nobody in the middle. The day the programme wants per-day type
 * availability again — an emergency, a campaign — this is one variable.
 *
 * Enable with `NEXT_PUBLIC_SANGRE_BANCOS=true`.
 */
export const listaDeBancosHabilitada = process.env.NEXT_PUBLIC_SANGRE_BANCOS === "true";
