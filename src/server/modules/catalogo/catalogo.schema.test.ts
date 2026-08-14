import { describe, expect, it } from "vitest";

import {
  buildTurnoId,
  construirTurnos,
  resolverCentroId,
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
    puntoDeAcopio: "Vive Claro",
    fecha: "2026-08-13",
    jornada: "AM",
    dia: null,
    horario: null,
    abierto: null,
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

  it("reads a dotted abbreviation as the same point", () => {
    // `Turnos` writes `C.C. Unicentro` where `Centros` writes `CC Unicentro`.
    expect(slugify("C.C. Unicentro")).toBe(slugify("CC Unicentro"));
  });
});

describe("resolverCentroId", () => {
  const conocidos = new Set(["cc-unicentro", "cruz-roja", "estadio-el-campin"]);

  it("matches a point spelled with dots", () => {
    expect(resolverCentroId("C.C. Unicentro", conocidos)).toBe("cc-unicentro");
  });

  it("drops a trailing venue qualifier the catalogue does not carry", () => {
    expect(resolverCentroId("Cruz Roja – Sede Administrativa", conocidos)).toBe("cruz-roja");
    expect(resolverCentroId("Cruz Roja - Sede Norte", conocidos)).toBe("cruz-roja");
  });

  it("prefers the exact name when the catalogue holds both", () => {
    const ambos = new Set(["cruz-roja", "cruz-roja-sede-administrativa"]);

    expect(resolverCentroId("Cruz Roja – Sede Administrativa", ambos)).toBe(
      "cruz-roja-sede-administrativa",
    );
  });

  it("does not strip a numbered venue, which is a different point", () => {
    // `Estadio El Campín 3` has no qualifier dash: it must not collapse.
    expect(resolverCentroId("Estadio El Campín 3", conocidos)).toBeNull();
  });

  it("answers null for a point nothing resolves to", () => {
    expect(resolverCentroId("Coliseo Inventado", conocidos)).toBeNull();
  });
});

describe("buildTurnoId", () => {
  it("is derivable from centre, date and shift", () => {
    expect(buildTurnoId("vive-claro", "2026-08-13", "PM")).toBe("vive-claro_2026-08-13_pm");
  });
});

describe("construirTurnos", () => {
  it("builds exactly the shifts the board lists, and no others", () => {
    // The centre states AM and PM capacity, but only the row creates a shift:
    // `Centros` is informative now, so nothing is derived from it.
    const turnos = construirTurnos([centro()], [fila()]);

    expect(turnos).toHaveLength(1);
    expect(turnos[0]).toMatchObject({
      id: "vive-claro_2026-08-13_am",
      cuposTotales: 150,
      estado: "ABIERTO",
    });
  });

  it("takes each row's capacity, so the same slot can differ by day", () => {
    const turnos = construirTurnos(
      [centro()],
      [fila({ cuposTotales: 300 }), fila({ fecha: "2026-08-14", cuposTotales: 150 })],
    );

    expect(turnos.find((t) => t.id === "vive-claro_2026-08-13_am")?.cuposTotales).toBe(300);
    expect(turnos.find((t) => t.id === "vive-claro_2026-08-14_am")?.cuposTotales).toBe(150);
  });

  it("opens a slot the programme invented, given its own schedule", () => {
    const horario = { inicio: "22:00", fin: "02:00", etiqueta: "10:00 p.m. - 2:00 a.m." };
    const turnos = construirTurnos(
      [centro()],
      [fila({ jornada: "MADRUGADA 2", horario, cuposTotales: 80 })],
    );

    expect(turnos.find((t) => t.id === "vive-claro_2026-08-13_madrugada-2")).toMatchObject({
      jornada: "MADRUGADA 2",
      horario,
      cuposTotales: 80,
      estado: "ABIERTO",
    });
  });

  it("takes the row's schedule and falls back to the slot's default", () => {
    const horario = { inicio: "06:00", fin: "10:00", etiqueta: "6:00 a.m. - 10:00 a.m." };
    const turnos = construirTurnos([centro()], [fila({ horario }), fila({ jornada: "TARDE" })]);

    expect(turnos.find((t) => t.id === "vive-claro_2026-08-13_am")?.horario).toEqual(horario);
    expect(turnos.find((t) => t.id === "vive-claro_2026-08-13_tarde")?.horario.inicio).toBe(
      "13:00",
    );
  });

  it("skips a slot with neither its own schedule nor a default", () => {
    // Inventing hours here would publish a time nobody authorised; the sync
    // rejects the row before this, with a verdict for its Validación cell.
    expect(construirTurnos([centro()], [fila({ jornada: "MADRUGADA 2" })])).toHaveLength(0);
  });

  it("keeps a shift closed while its point is retired, whatever the row says", () => {
    const turnos = construirTurnos([centro({ activo: false })], [fila({ cuposTotales: 500 })]);

    expect(turnos[0]).toMatchObject({ centroActivo: false, estado: "CERRADO" });
  });

  it("attaches a qualified spelling to the point the catalogue has", () => {
    const turnos = construirTurnos(
      [centro({ id: "cruz-roja", nombre: "Cruz Roja" })],
      [
        fila({
          centroId: "cruz-roja-sede-administrativa",
          puntoDeAcopio: "Cruz Roja – Sede Administrativa",
        }),
      ],
    );

    expect(turnos).toHaveLength(1);
    expect(turnos[0]).toMatchObject({ centroId: "cruz-roja", id: "cruz-roja_2026-08-13_am" });
  });

  it("ignores a row whose point is not in the catalogue", () => {
    const turnos = construirTurnos(
      [centro()],
      [fila(), fila({ centroId: "no-existe", puntoDeAcopio: "No Existe" })],
    );

    expect(turnos).toHaveLength(1);
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
