import { describe, expect, it } from "vitest";

import {
  filtrarPorLocalidad,
  filtrarPorTipo,
  localidadesDe,
  type BancoSangreVista,
  type TipoSangre,
} from "./sangre";

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
    lat: null,
    lng: null,
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

describe("localidadesDe", () => {
  const bancos = [
    banco({ id: "a", localidad: "Chapinero" }),
    banco({ id: "b", localidad: "Chapinero" }),
    banco({ id: "c", localidad: "Suba" }),
    banco({ id: "d", localidad: null }),
  ];

  it("counts the points in each locality", () => {
    expect(localidadesDe(bancos)).toEqual([
      { nombre: "Chapinero", cuantos: 2 },
      { nombre: "Suba", cuantos: 1 },
    ]);
  });

  it("leaves out banks with no locality rather than inventing a bucket", () => {
    expect(localidadesDe(bancos).map((l) => l.nombre)).not.toContain("");
  });

  it("orders alphabetically in Spanish, so the chips do not reshuffle", () => {
    const desordenados = [
      banco({ id: "a", localidad: "Usaquén" }),
      banco({ id: "b", localidad: "Bosa" }),
      banco({ id: "c", localidad: "Ángeles" }),
    ];
    expect(localidadesDe(desordenados).map((l) => l.nombre)).toEqual([
      "Ángeles",
      "Bosa",
      "Usaquén",
    ]);
  });

  it("describes whatever list it is handed, which is how it stays in step", () => {
    // Handed the type-filtered banks, the chips answer "where can I give O−"
    // instead of offering localities that lead nowhere.
    const soloUno = filtrarPorTipo(
      [
        banco({ id: "a", localidad: "Chapinero", tiposQueRecibe: ["O-"] }),
        banco({ id: "b", localidad: "Suba", tiposQueRecibe: ["AB+"] }),
      ],
      "O-",
    );
    expect(localidadesDe(soloUno)).toEqual([{ nombre: "Chapinero", cuantos: 1 }]);
  });

  it("has nothing to offer for an empty list", () => {
    expect(localidadesDe([])).toEqual([]);
  });
});

describe("filtrarPorLocalidad", () => {
  const bancos = [
    banco({ id: "chapi", localidad: "Chapinero" }),
    banco({ id: "suba", localidad: "Suba" }),
    banco({ id: "sin-localidad", localidad: null }),
  ];

  it("shows everything when no locality is chosen", () => {
    expect(filtrarPorLocalidad(bancos, null)).toHaveLength(3);
  });

  it("narrows to the chosen one", () => {
    expect(filtrarPorLocalidad(bancos, "Chapinero").map((b) => b.id)).toContain("chapi");
    expect(filtrarPorLocalidad(bancos, "Chapinero").map((b) => b.id)).not.toContain("suba");
  });

  it("keeps a bank whose locality cell is blank", () => {
    // Hiding a point because a column went unfilled turns the spreadsheet's gap
    // into a missing option for the donor.
    expect(filtrarPorLocalidad(bancos, "Chapinero").map((b) => b.id)).toContain("sin-localidad");
  });
});
