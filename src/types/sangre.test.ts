import { describe, expect, it } from "vitest";

import { filtrarPorTipo, type BancoSangreVista, type TipoSangre } from "./sangre";

function banco(overrides: Partial<BancoSangreVista> = {}): BancoSangreVista {
  return {
    id: "hospital-el-tunal",
    nombre: "Hospital El Tunal",
    direccion: "Cra. 20 #47B-35 Sur",
    localidad: "Tunjuelito",
    horarioOficial: "8:00 a.m. - 9:00 p.m.",
    linkMaps: null,
    tiposQueRecibe: ["O+", "O-"],
    resumenTipos: "O+, O−",
    recibiendoHoy: true,
    ...overrides,
  };
}

describe("filtrarPorTipo", () => {
  const bancos = [
    banco({ id: "recibe-el-tuyo", tiposQueRecibe: ["O+", "O-"] }),
    banco({ id: "recibe-otros", tiposQueRecibe: ["AB+"] }),
    banco({ id: "sin-tipos", tiposQueRecibe: [] }),
    banco({ id: "cerrado-hoy", recibiendoHoy: false, tiposQueRecibe: ["AB+"] }),
  ];

  it("shows every bank when the donor does not know their type", () => {
    expect(filtrarPorTipo(bancos, null)).toHaveLength(4);
  });

  it("keeps the bank that lists the chosen type", () => {
    expect(filtrarPorTipo(bancos, "O-").map((b) => b.id)).toContain("recibe-el-tuyo");
  });

  it("drops the bank that is receiving and did not list this type", () => {
    expect(filtrarPorTipo(bancos, "O-").map((b) => b.id)).not.toContain("recibe-otros");
  });

  it("keeps a bank that listed no types, because 'we did not say' is not 'no'", () => {
    // The card says so and points at Maps, which serves the donor better than a
    // shorter list that drops the option without explaining.
    expect(filtrarPorTipo(bancos, "AB-").map((b) => b.id)).toContain("sin-tipos");
  });

  it("drops a bank that is closed today once a type is chosen", () => {
    // Picking a type asks "where can I go right now", and a closed point is not
    // an answer — leaving it in makes the donor filter the list again by eye.
    expect(filtrarPorTipo(bancos, "AB-").map((b) => b.id)).not.toContain("cerrado-hoy");
  });

  it("still lists closed banks when no type is chosen", () => {
    expect(filtrarPorTipo(bancos, null).map((b) => b.id)).toContain("cerrado-hoy");
  });

  it("only ever keeps a bank that could take the donor today", () => {
    for (const tipo of ["O+", "A-", "AB+"] as TipoSangre[]) {
      for (const b of filtrarPorTipo(bancos, tipo)) {
        expect(b.recibiendoHoy).toBe(true);
        expect(b.tiposQueRecibe.length === 0 || b.tiposQueRecibe.includes(tipo)).toBe(true);
      }
    }
  });
});
