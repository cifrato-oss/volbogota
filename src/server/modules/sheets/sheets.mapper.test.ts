import { describe, expect, it } from "vitest";

import {
  estadoDesdeSheet,
  estadoHaciaSheet,
  estadoNecesidadDesdeSheet,
  fechaDesdeSheet,
  fechaHaciaSheet,
  horarioDesdeSheet,
  jornadaDesdeSheet,
  jornadaHaciaSheet,
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

  it("keeps the accent, because ID_Turno is matched literally on the sheet", () => {
    // `MAÑANA` folded to `MANANA` builds an id no row has, and the Reservados
    // write-back lands nowhere.
    expect(jornadaDesdeSheet("Mañana")).toBe("MAÑANA");
    expect(jornadaHaciaSheet("MAÑANA")).toBe("MAÑANA");
    expect(turnoIdDesdeSheet("Punto Usaquén|2026-08-15|MAÑANA")).toBe(
      "punto-usaquen_2026-08-15_manana",
    );
  });

  it("accepts a slot the programme invented, normalised to one spelling", () => {
    // The board decides which slots run; a closed list would reject the row
    // instead of opening the shift.
    expect(jornadaDesdeSheet("Madrugada")).toBe("MADRUGADA");
    expect(jornadaDesdeSheet("  madrugada  2 ")).toBe("MADRUGADA 2");
    expect(jornadaDesdeSheet("Tarde")).toBe("TARDE");
  });

  it("still refuses an empty slot", () => {
    expect(() => jornadaDesdeSheet("   ")).toThrowError(/vacía/i);
  });

  it("reads the evening shift the sheet labels 'Noche'", () => {
    expect(jornadaDesdeSheet("Noche")).toBe("NOCHE");
    expect(jornadaDesdeSheet(" noche ")).toBe("NOCHE");
  });
});

describe("horarioDesdeSheet", () => {
  it("reads the format the sheet already writes", () => {
    expect(horarioDesdeSheet("8:00 a.m. - 2:00 p.m.")).toEqual({
      inicio: "08:00",
      fin: "14:00",
      etiqueta: "8:00 a.m. - 2:00 p.m.",
    });
  });

  it("reads the spaced meridiem a Spanish-locale sheet writes", () => {
    // `a. m.` with a space: stripping dots alone left a lone `a`, which is the
    // range separator, so every AM row in the board was rejected.
    expect(horarioDesdeSheet("8:00 a. m. – 1:00 p. m.")).toMatchObject({
      inicio: "08:00",
      fin: "13:00",
    });
    expect(horarioDesdeSheet("1:00 p. m. – 6:00 p. m.")).toMatchObject({
      inicio: "13:00",
      fin: "18:00",
    });
    expect(horarioDesdeSheet("6:00 p. m. – 9:00 p. m.")).toMatchObject({
      inicio: "18:00",
      fin: "21:00",
    });
  });

  it("reads 24-hour ranges without a meridiem", () => {
    expect(horarioDesdeSheet("08:00-14:00")).toMatchObject({ inicio: "08:00", fin: "14:00" });
    expect(horarioDesdeSheet("19:00 – 22:00")).toMatchObject({ inicio: "19:00", fin: "22:00" });
  });

  it("accepts 'a' as the separator and hours without minutes", () => {
    expect(horarioDesdeSheet("7 p.m. a 10 p.m.")).toMatchObject({ inicio: "19:00", fin: "22:00" });
  });

  it("keeps the sheet's label verbatim, because that is what a volunteer reads", () => {
    expect(horarioDesdeSheet("  8:00 am - 2:00 pm  ").etiqueta).toBe("8:00 am - 2:00 pm");
  });

  it("puts midnight and noon on the right side of the clock", () => {
    expect(horarioDesdeSheet("12:00 a.m. - 12:00 p.m.")).toMatchObject({
      inicio: "00:00",
      fin: "12:00",
    });
  });

  it("refuses a schedule it cannot read instead of falling back to the default", () => {
    // A shift running at a different hour than the sheet says is worse than a
    // row a coordinator can see was rejected.
    expect(() => horarioDesdeSheet("por la mañana")).toThrowError(/no entiendo el horario/i);
    expect(() => horarioDesdeSheet("8:00 - 25:00")).toThrowError(/no existe/i);
    expect(() => horarioDesdeSheet("8:00 - 14:70")).toThrowError(/no existe/i);
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

describe("estadoNecesidadDesdeSheet", () => {
  it("reads the dropdown's three words for the semaphore", () => {
    expect(estadoNecesidadDesdeSheet("Se necesita")).toBe("SE_NECESITA");
    expect(estadoNecesidadDesdeSheet("No se necesita")).toBe("SUFICIENTE");
    expect(estadoNecesidadDesdeSheet("No se recibe")).toBe("NO_APLICA");
  });

  it("is case- and accent-insensitive", () => {
    expect(estadoNecesidadDesdeSheet("NO SE RECIBE")).toBe("NO_APLICA");
    expect(estadoNecesidadDesdeSheet("se necesita")).toBe("SE_NECESITA");
  });

  it("returns null for a value the dropdown does not use, instead of throwing", () => {
    // A bad cell must not take the rest of the sheet's edit down with it.
    expect(estadoNecesidadDesdeSheet("Suficiente")).toBeNull();
    expect(estadoNecesidadDesdeSheet("Tal vez")).toBeNull();
  });
});
