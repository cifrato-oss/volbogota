import { describe, expect, it } from "vitest";

import { EDAD_MINIMA, crearReservaSchema } from "./reservas.schema";

const valido = {
  nombre: "Ana María",
  apellido: "Ramírez Gómez",
  celular: "3001234567",
  edad: 30,
  turnoId: "cruz-roja_2026-08-13_am",
  autorizoDatos: true,
};

function issuesFor(input: unknown): string[] {
  const result = crearReservaSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}

describe("crearReservaSchema", () => {
  it("accepts the five fields the form asks for", () => {
    expect(crearReservaSchema.safeParse(valido).success).toBe(true);
  });

  it("requires name and surname separately", () => {
    expect(issuesFor({ ...valido, apellido: "" })).toContain("apellido");
    expect(issuesFor({ ...valido, nombre: "" })).toContain("nombre");
  });

  it("trims both", () => {
    const parsed = crearReservaSchema.parse({
      ...valido,
      nombre: "  Ana María  ",
      apellido: "  Ramírez  ",
    });

    expect(parsed.nombre).toBe("Ana María");
    expect(parsed.apellido).toBe("Ramírez");
  });

  it("strips separators from the phone number before validating", () => {
    expect(crearReservaSchema.parse({ ...valido, celular: "300 123 4567" }).celular).toBe(
      "3001234567",
    );
  });

  it.each([
    ["landline", "6011234567"],
    ["too short", "300123456"],
    ["too long", "30012345678"],
  ])("rejects a %s number", (_label, celular) => {
    expect(issuesFor({ ...valido, celular })).toContain("celular");
  });

  it(`rejects anyone under ${EDAD_MINIMA}`, () => {
    expect(issuesFor({ ...valido, edad: EDAD_MINIMA - 1 })).toContain("edad");
  });

  it(`accepts exactly ${EDAD_MINIMA}`, () => {
    expect(crearReservaSchema.safeParse({ ...valido, edad: EDAD_MINIMA }).success).toBe(true);
  });

  it("accepts an age typed into a text input", () => {
    // A number input still hands over a string in plenty of browsers.
    expect(crearReservaSchema.parse({ ...valido, edad: "42" }).edad).toBe(42);
  });

  it.each([
    ["fractional", 20.5],
    ["implausible", 130],
    ["not a number", "veinte"],
  ])("rejects an %s age", (_label, edad) => {
    expect(issuesFor({ ...valido, edad })).toContain("edad");
  });

  it("rejects a booking without data-processing consent", () => {
    expect(issuesFor({ ...valido, autorizoDatos: false })).toContain("autorizoDatos");
  });

  it("requires a shift", () => {
    expect(issuesFor({ ...valido, turnoId: "" })).toContain("turnoId");
  });

  it("ignores fields the contract does not model", () => {
    // `eps` and `contactoEmergencia` used to be dropped here too; they are
    // modelled now, and the emergency contact is the phone, not an object.
    const parsed = crearReservaSchema.parse({ ...valido, notas: "algo", actividad: "Empaque" });

    expect(parsed).not.toHaveProperty("notas");
    expect(parsed).not.toHaveProperty("actividad");
  });
});

describe("contacto de emergencia y EPS", () => {
  const base = {
    nombre: "Fulanita",
    apellido: "Pérez",
    celular: "3001234567",
    edad: 22,
    turnoId: "punto-usaquen_2026-08-15_manana",
    autorizoDatos: true as const,
  };

  it("los acepta y los recorta", () => {
    const parsed = crearReservaSchema.parse({
      ...base,
      contactoEmergencia: "  601 555 4433  ",
      eps: "  Sanitas  ",
    });

    expect(parsed).toMatchObject({ contactoEmergencia: "601 555 4433", eps: "Sanitas" });
  });

  it("no rompe una reserva que todavía no los manda", () => {
    // El formulario aún no los pide: exigirlos tumbaría cada inscripción.
    expect(crearReservaSchema.parse(base)).toMatchObject({
      contactoEmergencia: null,
      eps: null,
    });
  });

  it("lee una celda vacía como ausente, no como cadena vacía", () => {
    expect(crearReservaSchema.parse({ ...base, contactoEmergencia: "   ", eps: "" })).toMatchObject(
      {
        contactoEmergencia: null,
        eps: null,
      },
    );
  });

  it("no exige el formato de celular colombiano al contacto de emergencia", () => {
    // Suele ser un fijo o un familiar en el exterior.
    expect(
      crearReservaSchema.parse({ ...base, contactoEmergencia: "+34 600 123 456" })
        .contactoEmergencia,
    ).toBe("+34 600 123 456");
  });
});
