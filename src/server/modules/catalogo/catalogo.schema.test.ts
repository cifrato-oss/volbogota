import { describe, expect, it } from "vitest";

import {
  buildTurnoId,
  construirTurnos,
  slugify,
  toTurnoPublico,
  type Centro,
  type Turno,
  type TurnoDeHoja,
} from "./catalogo.schema";

function centro(overrides: Partial<Centro> = {}): Centro {
  return {
    id: "vive-claro",
    nombre: "Vive Claro",
    direccion: "Cra. 60 #42-41",
    localidad: "Teusaquillo",
    linkMaps: null,
    horarioOficial: "8:00 a.m. - 9:00 p.m.",
    observaciones: null,
    actividades: ["Empaque"],
    cuposPorJornada: { AM: 300, PM: 200 },
    activo: true,
    coordinador: null,
    ...overrides,
  };
}

function fila(overrides: Partial<TurnoDeHoja> = {}): TurnoDeHoja {
  return {
    centroId: "vive-claro",
    fecha: "2026-08-13",
    jornada: "AM",
    horario: null,
    cuposTotales: 150,
    ...overrides,
  };
}

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
    expect(buildTurnoId("vive-claro", "2026-08-13", "PM")).toBe("vive-claro_2026-08-13_pm");
  });
});

describe("construirTurnos", () => {
  it("derives one shift per centre, date and slot from the nominal capacity", () => {
    const turnos = construirTurnos([centro()], ["2026-08-13", "2026-08-14"]);

    expect(turnos).toHaveLength(6);
    expect(turnos.find((t) => t.id === "vive-claro_2026-08-13_am")?.cuposTotales).toBe(300);
    // No evening capacity in the centre means the shift exists but is closed.
    expect(turnos.find((t) => t.id === "vive-claro_2026-08-13_noche")).toMatchObject({
      cuposTotales: 0,
      estado: "CERRADO",
    });
  });

  it("lets a sheet row override the capacity for one day only", () => {
    const turnos = construirTurnos(
      [centro()],
      ["2026-08-13", "2026-08-14"],
      [fila({ fecha: "2026-08-14", cuposTotales: 150 })],
    );

    expect(turnos.find((t) => t.id === "vive-claro_2026-08-13_am")?.cuposTotales).toBe(300);
    expect(turnos.find((t) => t.id === "vive-claro_2026-08-14_am")?.cuposTotales).toBe(150);
    expect(turnos).toHaveLength(6);
  });

  it("opens a shift the nominal capacity leaves closed", () => {
    const turnos = construirTurnos(
      [centro()],
      ["2026-08-13"],
      [fila({ jornada: "NOCHE", cuposTotales: 80 })],
    );

    expect(turnos.find((t) => t.id === "vive-claro_2026-08-13_noche")).toMatchObject({
      cuposTotales: 80,
      estado: "ABIERTO",
    });
  });

  it("creates a shift on a date outside the programme's calendar", () => {
    const turnos = construirTurnos([centro()], ["2026-08-13"], [fila({ fecha: "2026-08-20" })]);

    expect(turnos).toHaveLength(4);
    expect(turnos.find((t) => t.id === "vive-claro_2026-08-20_am")).toMatchObject({
      fecha: "2026-08-20",
      diaSemana: "Jueves",
      cuposTotales: 150,
    });
  });

  it("takes the row's schedule and falls back to the shift's default", () => {
    const horario = { inicio: "06:00", fin: "10:00", etiqueta: "6:00 a.m. - 10:00 a.m." };
    const turnos = construirTurnos(
      [centro()],
      ["2026-08-13"],
      [fila({ horario }), fila({ jornada: "PM" })],
    );

    expect(turnos.find((t) => t.id === "vive-claro_2026-08-13_am")?.horario).toEqual(horario);
    expect(turnos.find((t) => t.id === "vive-claro_2026-08-13_pm")?.horario.inicio).toBe("13:00");
  });

  it("keeps a shift closed while its point is retired, whatever the row says", () => {
    const turnos = construirTurnos(
      [centro({ activo: false })],
      ["2026-08-13"],
      [fila({ cuposTotales: 500 })],
    );

    expect(turnos.find((t) => t.id === "vive-claro_2026-08-13_am")).toMatchObject({
      centroActivo: false,
      estado: "CERRADO",
    });
  });

  it("ignores a row whose point is not in the catalogue", () => {
    const turnos = construirTurnos([centro()], ["2026-08-13"], [fila({ centroId: "no-existe" })]);

    expect(turnos).toHaveLength(3);
    expect(turnos.every((t) => t.centroId === "vive-claro")).toBe(true);
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
