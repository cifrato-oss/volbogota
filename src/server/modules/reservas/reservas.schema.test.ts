import { describe, expect, it } from "vitest";

import { crearReservaSchema } from "./reservas.schema";

const valido = {
  nombre: "Ana María Ramírez",
  celular: "3001234567",
  turnoId: "vive-claro_2026-08-13_am",
  actividad: "Empaque",
  autorizoDatos: true,
  mayorDeEdad: true,
};

function issuesFor(input: unknown): string[] {
  const result = crearReservaSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
}

describe("crearReservaSchema", () => {
  it("accepts a complete booking", () => {
    expect(crearReservaSchema.safeParse(valido).success).toBe(true);
  });

  it("strips separators from the phone number before validating", () => {
    const result = crearReservaSchema.parse({ ...valido, celular: "300 123 4567" });
    expect(result.celular).toBe("3001234567");
  });

  it.each([
    ["landline", "6011234567"],
    ["too short", "300123456"],
    ["too long", "30012345678"],
  ])("rejects a %s number", (_label, celular) => {
    expect(issuesFor({ ...valido, celular })).toContain("celular");
  });

  it("rejects a booking without data-processing consent", () => {
    expect(issuesFor({ ...valido, autorizoDatos: false })).toContain("autorizoDatos");
  });

  it("rejects a minor", () => {
    expect(issuesFor({ ...valido, mayorDeEdad: false })).toContain("mayorDeEdad");
  });

  it("rejects an activity outside the catalogue", () => {
    expect(issuesFor({ ...valido, actividad: "Logística" })).toContain("actividad");
  });

  it("trims the name and requires a real one", () => {
    expect(crearReservaSchema.parse({ ...valido, nombre: "  Ana Ramírez  " }).nombre).toBe(
      "Ana Ramírez",
    );
    expect(issuesFor({ ...valido, nombre: "A" })).toContain("nombre");
  });

  it("validates the emergency contact number with the same rule", () => {
    expect(
      issuesFor({
        ...valido,
        contactoEmergencia: { nombre: "Pedro Pérez", celular: "123" },
      }),
    ).toContain("contactoEmergencia.celular");
  });
});
