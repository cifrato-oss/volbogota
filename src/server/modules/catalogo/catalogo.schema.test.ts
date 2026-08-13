import { describe, expect, it } from "vitest";

import {
  buildTurnoId,
  formatearHora12,
  horarioDeJornada,
  slugify,
  toTurnoPublico,
  type Turno,
} from "./catalogo.schema";

function turno(overrides: Partial<Turno> = {}): Turno {
  return {
    id: "vive-claro_2026-08-13_manana",
    centroId: "vive-claro",
    centroNombre: "Vive Claro",
    fecha: "2026-08-13",
    diaSemana: "Jueves",
    jornada: "MANANA",
    horario: { inicio: "08:00", fin: "12:00", etiqueta: "8:00 a.m. - 12:00 m." },
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

describe("formatearHora12", () => {
  it("renders morning and afternoon hours in Colombian Spanish", () => {
    expect(formatearHora12("08:00")).toBe("8:00 a.m.");
    expect(formatearHora12("13:00")).toBe("1:00 p.m.");
    expect(formatearHora12("21:30")).toBe("9:30 p.m.");
    expect(formatearHora12("00:00")).toBe("12:00 a.m.");
    expect(formatearHora12("12:00")).toBe("12:00 p.m.");
  });
});

describe("horarioDeJornada", () => {
  it("runs Mañana from the centre's opening until noon", () => {
    expect(horarioDeJornada({ apertura: "08:00", cierre: "20:00" }, "MANANA")).toEqual({
      inicio: "08:00",
      fin: "12:00",
      etiqueta: "8:00 a.m. - 12:00 m.",
    });
  });

  it("runs Noche from 1 p.m. until the centre's closing", () => {
    expect(horarioDeJornada({ apertura: "08:00", cierre: "20:00" }, "NOCHE")).toEqual({
      inicio: "13:00",
      fin: "20:00",
      etiqueta: "1:00 p.m. - 8:00 p.m.",
    });
  });

  it("falls back to a placeholder when the centre has not confirmed its hours", () => {
    expect(horarioDeJornada({ apertura: null, cierre: null }, "MANANA").etiqueta).toBe(
      "Horario por confirmar",
    );
    expect(horarioDeJornada({ apertura: null, cierre: null }, "NOCHE").etiqueta).toBe(
      "Horario por confirmar",
    );
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
