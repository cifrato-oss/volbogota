import { describe, expect, it } from "vitest";

import { ESTADOS_RESERVA } from "./reservas.schema";
import { puedeTransicionar } from "./reservas.admin.schema";

describe("puedeTransicionar", () => {
  it("follows the flow the spreadsheet describes", () => {
    expect(puedeTransicionar("RESERVADO", "CONFIRMADO")).toBe(true);
    expect(puedeTransicionar("CONFIRMADO", "ASISTIO")).toBe(true);
    expect(puedeTransicionar("CONFIRMADO", "NO_ASISTIO")).toBe(true);
  });

  it("allows cancelling before the shift resolves", () => {
    expect(puedeTransicionar("RESERVADO", "CANCELADO")).toBe(true);
    expect(puedeTransicionar("CONFIRMADO", "CANCELADO")).toBe(true);
  });

  it("never walks a resolved reservation back to a plan", () => {
    expect(puedeTransicionar("ASISTIO", "RESERVADO")).toBe(false);
    expect(puedeTransicionar("ASISTIO", "CONFIRMADO")).toBe(false);
    expect(puedeTransicionar("NO_ASISTIO", "CONFIRMADO")).toBe(false);
  });

  it("lets a coordinator fix a mistyped attendance", () => {
    expect(puedeTransicionar("ASISTIO", "NO_ASISTIO")).toBe(true);
    expect(puedeTransicionar("NO_ASISTIO", "ASISTIO")).toBe(true);
  });

  it("treats cancelled as final", () => {
    for (const estado of ESTADOS_RESERVA) {
      expect(puedeTransicionar("CANCELADO", estado)).toBe(false);
    }
  });

  it("cannot mark attendance on something already cancelled", () => {
    expect(puedeTransicionar("CANCELADO", "ASISTIO")).toBe(false);
  });
});
