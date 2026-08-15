import { z } from "zod";

import { slugify } from "@/server/modules/catalogo/catalogo.schema";

/**
 * Domain vocabulary for the "Quiero donar sangre" flow.
 *
 * A blood bank is not a collection point, even when it shares an address with
 * one. What it accepts changes during the day — a bank that only wants O− at
 * seven can be taking everything by noon — so the interesting field here is not
 * the list of types, it is **when that list was last confirmed**.
 *
 * That is why this module has no "sin reporte" state stored anywhere: it is
 * derived from `actualizadoEn` not being today. A stored flag would be one more
 * thing a coordinator has to remember to clear every morning, and the morning
 * they forget is the morning a donor drives across the city for nothing.
 */

/** The eight ABO/Rh combinations, in the order the picker lays them out. */
export const TIPOS_SANGRE = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"] as const;
export const tipoSangreSchema = z.enum(TIPOS_SANGRE, {
  error: () => `El tipo de sangre debe ser uno de: ${TIPOS_SANGRE.join(", ")}.`,
});
export type TipoSangre = z.infer<typeof tipoSangreSchema>;

/**
 * Normalises what a coordinator types into a canonical type.
 *
 * The sheet is written by hand, so "a+", "A +", "0+" and "O positivo" all mean
 * the same thing. The zero for the letter O is the one worth special-casing:
 * they are adjacent on the keyboard and identical in most typefaces.
 */
export function normalizarTipo(valor: string): TipoSangre | null {
  const limpio = valor
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/0/g, "O")
    .replace(/POSITIVO|POS/g, "+")
    .replace(/NEGATIVO|NEG/g, "-")
    .replace(/−|–|—/g, "-");

  return (TIPOS_SANGRE as readonly string[]).includes(limpio) ? (limpio as TipoSangre) : null;
}

/** The four Rh-negative types, which coordinators write as a single "RH−". */
export const RH_NEGATIVOS: TipoSangre[] = ["O-", "A-", "B-", "AB-"];
export const RH_POSITIVOS: TipoSangre[] = ["O+", "A+", "B+", "AB+"];

/**
 * Splits the sheet's `Tipo de Sangre` cell into canonical types.
 *
 * Coordinators write families, not just types: "O+, RH-" means O positive plus
 * every Rh negative, and that is how the mockups phrase it too. Expanding here
 * is what lets an O− donor match a bank that never typed "O−" — before this, the
 * token was dropped silently, which is the worst way to be wrong: the donor sees
 * a shorter list and no indication that anything was ignored.
 */
export function parsearTipos(celda: string | null | undefined): TipoSangre[] {
  if (!celda) return [];

  const tipos = new Set<TipoSangre>();

  for (const parte of celda.split(/[,;/]|\by\b/i)) {
    const limpio = parte.toUpperCase().replace(/\s+/g, "").replace(/−|–|—/g, "-");

    // "Todos" is a value in the sheet's own dropdown, and it is what a
    // coordinator reaches for on a day with no restriction. Dropping it left the
    // bank showing "tipos sin confirmar" — the one state that means the opposite
    // of what was written.
    if (/^TODOS?(LOS)?(TIPOS)?$/.test(limpio) || /^CUALQUIERA?$/.test(limpio)) {
      TIPOS_SANGRE.forEach((tipo) => tipos.add(tipo));
      continue;
    }

    if (/^RH-?$|^RHNEG/.test(limpio)) {
      RH_NEGATIVOS.forEach((tipo) => tipos.add(tipo));
      continue;
    }

    if (/^RH\+$|^RHPOS/.test(limpio)) {
      RH_POSITIVOS.forEach((tipo) => tipos.add(tipo));
      continue;
    }

    const tipo = normalizarTipo(parte);
    if (tipo) tipos.add(tipo);
  }

  // Ordered by the canonical list rather than by how they were typed, so two
  // banks accepting the same types always render identically.
  return TIPOS_SANGRE.filter((tipo) => tipos.has(tipo));
}

export const bancoSangreSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1),
  direccion: z.string().nullable(),
  localidad: z.string().nullable(),
  horarioOficial: z.string().nullable(),
  linkMaps: z.string().nullable(),
  /**
   * Types accepted right now, expanded — "RH−" becomes its four types. This is
   * what the filter matches against, and it exists so the machine never has to
   * interpret a coordinator's shorthand at read time.
   */
  tiposQueRecibe: z.array(tipoSangreSchema),
  /**
   * What the coordinator actually wrote: "O+, RH-".
   *
   * Kept beside the expanded list because the card shows a person's words, not a
   * machine's expansion — "HOY SOLO O+ Y RH−" reads better and is shorter than
   * spelling out five types. Filtering uses `tiposQueRecibe`; display uses this.
   */
  resumenTipos: z.string().nullable(),
  /**
   * Whether the bank is taking donations at all today.
   *
   * Separate from `tiposQueRecibe` being empty, and from never having reported.
   * Three different things a donor needs told apart: "we are open but only want
   * O−", "we are not drawing blood today", and "nobody has said". Only the first
   * two are a coordinator's answer; the third is the absence of one.
   */
  recibiendoHoy: z.boolean(),
  activo: z.boolean(),
  /** ISO instant of the last time the sheet confirmed this bank's list. */
  actualizadoEn: z.string().nullable(),
  /**
   * Written only by `pnpm run seed:sangre`, never by the sheet.
   *
   * It has to be declared here or it does not exist downstream at all: reads go
   * through this schema and Zod drops what it does not know, so a filter on an
   * undeclared field silently matches nothing — which is exactly how sixteen
   * invented banks passed a check that was supposed to stop them.
   */
  esMock: z.boolean().optional(),
});

export type BancoSangre = z.infer<typeof bancoSangreSchema>;

/**
 * The id comes from the name, matching how `centros` are keyed.
 *
 * Worth stating plainly because it bit this project already: renaming a bank in
 * the sheet re-keys the document and orphans anything pointing at the old id.
 * Nothing points at a blood bank yet, so the cost today is a duplicate row —
 * but the day something does, this is where to add an explicit id column.
 */
export function idDeBanco(nombre: string): string {
  return slugify(nombre);
}
