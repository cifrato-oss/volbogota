import { describe, expect, it } from "vitest";

import { buildTurnoId, slugify, toTurnoPublico, type Turno } from "./catalogo.schema";

function turno(overrides: Partial<Turno> = {}): Turno {
  return {
    id: "vive-claro_2026-08-13_am",
    centroId: "vive-claro",
    centroNombre: "Vive Claro",
    fecha: "2026-08-13",
    diaSemana: "Jueves",
    jornada: "AM",
    horario: { inicio: "08:00", fin: "14:00", etiqueta: "8:00 a.m. - 2:00 p.m." },
    horarioOficialCentro: "8:00 a.m. - 9:00 p.m.",
    centroActivo: true,
    cuposTotales: 300,
    reservados: 0,
    estado: "ABIERTO",
    coordinador: null,
    ...overrides,
  };
}

describe("slugify", () => {
  it("folds accents and spaces into an ASCII id", () => {
    expect(slugify("Estadio El Campín")).toBe("estadio-el-campin");
    expect(slugify("U. Jorge Tadeo Lozano")).toBe("u-jorge-tadeo-lozano");
    expect(slugify("CC Nuestro Bogotá")).toBe("cc-nuestro-bogota");
  });
});

describe("buildTurnoId", () => {
  it("is derivable from centre, date and shift", () => {
    expect(buildTurnoId("vive-claro", "2026-08-13", "NOCHE")).toBe("vive-claro_2026-08-13_noche");
  });
});

describe("toTurnoPublico", () => {
  it("derives availability from the counter", () => {
    const result = toTurnoPublico(turno({ reservados: 120 }));

    expect(result.disponibles).toBe(180);
    expect(result.ocupacion).toBeCloseTo(0.4);
    expect(result.agotado).toBe(false);
  });

  it("marks a full shift as agotado", () => {
    expect(toTurnoPublico(turno({ reservados: 300 })).agotado).toBe(true);
  });

  it("never reports negative availability if a shift was oversold", () => {
    // Capacity can be lowered in the spreadsheet after bookings were taken.
    const result = toTurnoPublico(turno({ cuposTotales: 100, reservados: 130 }));

    expect(result.disponibles).toBe(0);
    expect(result.agotado).toBe(true);
  });

  it("does not divide by zero when a shift has no capacity", () => {
    expect(toTurnoPublico(turno({ cuposTotales: 0, reservados: 0 })).ocupacion).toBe(0);
  });
});
