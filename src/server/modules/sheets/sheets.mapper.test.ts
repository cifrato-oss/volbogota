import { describe, expect, it } from "vitest";

import {
  estadoDesdeSheet,
  estadoHaciaSheet,
  fechaDesdeSheet,
  fechaHaciaSheet,
  jornadaDesdeSheet,
  nombreCompletoHaciaSheet,
  partirNombreCompleto,
  siNoDesdeSheet,
  turnoIdDesdeColumnas,
  turnoIdDesdeSheet,
} from "./sheets.mapper";

describe("fechas", () => {
  it("reads the sheet's DD/MM/YYYY", () => {
    expect(fechaDesdeSheet("13/08/2026")).toBe("2026-08-13");
  });

  it("pads single-digit days and months", () => {
    expect(fechaDesdeSheet("1/8/2026")).toBe("2026-08-01");
  });

  it("passes an already-ISO date through", () => {
    expect(fechaDesdeSheet("2026-08-13")).toBe("2026-08-13");
  });

  it("refuses a date it cannot read instead of guessing", () => {
    // Guessing here would silently book people onto the wrong day.
    expect(() => fechaDesdeSheet("13 de agosto")).toThrowError(/no entiendo la fecha/i);
  });

  it("round-trips back to the sheet's format", () => {
    expect(fechaHaciaSheet("2026-08-13")).toBe("13/08/2026");
  });
});

describe("jornadas", () => {
  it("maps the sheet's labels to the domain's", () => {
    expect(jornadaDesdeSheet("AM")).toBe("AM");
    expect(jornadaDesdeSheet("PM")).toBe("PM");
  });

  it("ignores case and surrounding space", () => {
    expect(jornadaDesdeSheet(" am ")).toBe("AM");
    expect(jornadaDesdeSheet("pm")).toBe("PM");
  });

  it("rejects anything outside the two slots", () => {
    expect(() => jornadaDesdeSheet("Madrugada")).toThrowError(/no es válida/i);
  });

  it("rejects the retired evening shift the sheet's dropdown still offers", () => {
    // Such a row must come back with a verdict, not book a shift that is gone.
    expect(() => jornadaDesdeSheet("Noche")).toThrowError(/no es válida/i);
  });
});

describe("turnoId", () => {
  it("translates the sheet's piped id into the Firestore one", () => {
    expect(turnoIdDesdeSheet("Punto Usaquén|2026-08-13|AM")).toBe("punto-usaquen_2026-08-13_am");
  });

  it("slugs accents and punctuation out of the point's name", () => {
    expect(turnoIdDesdeSheet("U. Jorge Tadeo Lozano|2026-08-13|PM")).toBe(
      "u-jorge-tadeo-lozano_2026-08-13_pm",
    );
  });

  it("builds the same id from the separate columns", () => {
    expect(turnoIdDesdeColumnas("Punto Usaquén", "13/08/2026", "AM")).toBe(
      "punto-usaquen_2026-08-13_am",
    );
  });

  it("rejects an id that is not three parts", () => {
    expect(() => turnoIdDesdeSheet("Punto Usaquén|2026-08-13")).toThrowError(/ID_Turno/);
  });
});

describe("estados", () => {
  it("maps the sheet's accented labels", () => {
    expect(estadoDesdeSheet("Asistió")).toBe("ASISTIO");
    expect(estadoDesdeSheet("No asistió")).toBe("NO_ASISTIO");
  });

  it("accepts the same word without its accent", () => {
    expect(estadoDesdeSheet("asistio")).toBe("ASISTIO");
  });

  it("rejects a state that is not in the flow", () => {
    expect(() => estadoDesdeSheet("Pendiente")).toThrowError(/no es válido/i);
  });

  it("round-trips back to the label the sheet shows", () => {
    expect(estadoHaciaSheet("NO_ASISTIO")).toBe("No asistió");
  });
});

describe("sí/no", () => {
  it("reads the sheet's Sí as true", () => {
    expect(siNoDesdeSheet("Sí")).toBe(true);
    expect(siNoDesdeSheet("si")).toBe(true);
  });

  it("treats anything else, including empty, as false", () => {
    expect(siNoDesdeSheet("No")).toBe(false);
    expect(siNoDesdeSheet(null)).toBe(false);
    expect(siNoDesdeSheet("")).toBe(false);
  });
});

describe("partirNombreCompleto", () => {
  it("splits three words as one given name and two surnames", () => {
    expect(partirNombreCompleto("Fulanita Pérez Gómez")).toEqual({
      nombre: "Fulanita",
      apellido: "Pérez Gómez",
    });
  });

  it("splits four words down the middle, the common Colombian pattern", () => {
    expect(partirNombreCompleto("Ana María Ramírez Gómez")).toEqual({
      nombre: "Ana María",
      apellido: "Ramírez Gómez",
    });
  });

  it("handles two words", () => {
    expect(partirNombreCompleto("Ana Ramírez")).toEqual({ nombre: "Ana", apellido: "Ramírez" });
  });

  it("collapses extra whitespace", () => {
    expect(partirNombreCompleto("  Ana   Ramírez  ")).toEqual({
      nombre: "Ana",
      apellido: "Ramírez",
    });
  });

  it("leaves the surname empty for a single word, so validation rejects it", () => {
    // The contract requires a surname of at least two characters, so this row
    // comes back as a validation error rather than a half-identified volunteer.
    expect(partirNombreCompleto("Ana")).toEqual({ nombre: "Ana", apellido: "" });
  });

  it("round-trips through the sheet's single column", () => {
    const { nombre, apellido } = partirNombreCompleto("Ana María Ramírez Gómez");

    expect(nombreCompletoHaciaSheet(nombre, apellido)).toBe("Ana María Ramírez Gómez");
  });
});
