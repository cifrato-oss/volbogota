import { describe, expect, it } from "vitest";

import { idDeBanco, normalizarTipo, parsearTipos, RH_NEGATIVOS } from "./sangre.schema";

describe("normalizarTipo", () => {
  it("accepts the canonical spellings unchanged", () => {
    expect(normalizarTipo("O+")).toBe("O+");
    expect(normalizarTipo("AB-")).toBe("AB-");
  });

  it("folds the casing and spacing a hand-typed cell arrives with", () => {
    expect(normalizarTipo("a+")).toBe("A+");
    expect(normalizarTipo(" B - ")).toBe("B-");
  });

  it("reads a typed zero as the letter O", () => {
    // Adjacent keys, identical glyph in most typefaces. A donor whose bank typed
    // "0+" should still match O+.
    expect(normalizarTipo("0+")).toBe("O+");
    expect(normalizarTipo("0-")).toBe("O-");
  });

  it("understands the words a coordinator writes instead of a sign", () => {
    expect(normalizarTipo("O positivo")).toBe("O+");
    expect(normalizarTipo("A NEGATIVO")).toBe("A-");
    expect(normalizarTipo("B neg")).toBe("B-");
  });

  it("accepts the typographic minus that a spreadsheet autocorrects into", () => {
    expect(normalizarTipo("O−")).toBe("O-");
    expect(normalizarTipo("A–")).toBe("A-");
  });

  it("returns null rather than guessing at something it does not recognise", () => {
    expect(normalizarTipo("")).toBeNull();
    expect(normalizarTipo("C+")).toBeNull();
    expect(normalizarTipo("todos")).toBeNull();
  });
});

describe("parsearTipos", () => {
  it("treats an empty cell as no answer, not as an empty list of types", () => {
    expect(parsearTipos(null)).toEqual([]);
    expect(parsearTipos(undefined)).toEqual([]);
    expect(parsearTipos("   ")).toEqual([]);
  });

  it("splits on every separator a coordinator reaches for", () => {
    expect(parsearTipos("O+, A+")).toEqual(["O+", "A+"]);
    expect(parsearTipos("O+; A+")).toEqual(["O+", "A+"]);
    expect(parsearTipos("O+ / A+")).toEqual(["O+", "A+"]);
    expect(parsearTipos("O+ y A+")).toEqual(["O+", "A+"]);
  });

  it("expands the RH− family, which is how the sheet phrases it", () => {
    // The reason this module exists: an O− donor has to match a bank that never
    // typed "O−". Before expansion the token was dropped in silence.
    expect(parsearTipos("RH-")).toEqual(RH_NEGATIVOS);
    expect(parsearTipos("RH−")).toEqual(RH_NEGATIVOS);
    expect(parsearTipos("RH negativo")).toEqual(RH_NEGATIVOS);
    expect(parsearTipos("rh")).toEqual(RH_NEGATIVOS);
  });

  it("expands the RH+ family too", () => {
    expect(parsearTipos("RH+")).toEqual(["O+", "A+", "B+", "AB+"]);
    expect(parsearTipos("RH positivo")).toEqual(["O+", "A+", "B+", "AB+"]);
  });

  it("mixes a family with a single type, the way the mockups phrase it", () => {
    expect(parsearTipos("O+, RH-")).toEqual(["O+", "O-", "A-", "B-", "AB-"]);
  });

  it("returns canonical order regardless of how the cell was typed", () => {
    // Two banks accepting the same types must render identically, so ordering
    // follows TIPOS_SANGRE and not the coordinator's keystrokes.
    expect(parsearTipos("AB-, O+, B+")).toEqual(["O+", "B+", "AB-"]);
    expect(parsearTipos("B+, AB-, O+")).toEqual(["O+", "B+", "AB-"]);
  });

  it("collapses a type named twice, including via its family", () => {
    expect(parsearTipos("O-, RH-")).toEqual(RH_NEGATIVOS);
    expect(parsearTipos("A+, A+")).toEqual(["A+"]);
  });

  it("keeps the tokens it understands and drops only the ones it does not", () => {
    expect(parsearTipos("O+, cualquiera, A-")).toEqual(["O+", "A-"]);
  });
});

describe("idDeBanco", () => {
  it("keys a bank by its name, the way centros are keyed", () => {
    expect(idDeBanco("Hospital El Tunal")).toBe("hospital-el-tunal");
    expect(idDeBanco("IDCBIS")).toBe("idcbis");
  });

  it("folds accents so a tilde typed twice does not create a second bank", () => {
    expect(idDeBanco("Punto Secretaría de Salud")).toBe("punto-secretaria-de-salud");
  });
});
