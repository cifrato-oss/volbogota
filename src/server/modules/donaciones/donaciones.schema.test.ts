import { describe, expect, it } from "vitest";

import {
  buildElementoId,
  buildNecesidadId,
  toNecesidadPublica,
  type Necesidad,
} from "./donaciones.schema";

function necesidad(overrides: Partial<Necesidad> = {}): Necesidad {
  return {
    id: "cruz-roja_alimentos-arroz-blanco",
    centroId: "cruz-roja",
    centroNombre: "Cruz Roja",
    elementoId: "alimentos-arroz-blanco",
    categoria: "Alimentos",
    elemento: "Arroz blanco",
    estado: "SE_NECESITA",
    actualizadoEn: "2026-08-13T08:00:00.000Z",
    ...overrides,
  };
}

describe("buildElementoId", () => {
  it("folds category and name into a stable, ASCII id", () => {
    expect(buildElementoId("Alimentos", "Arroz blanco")).toBe("alimentos-arroz-blanco");
    expect(buildElementoId("Materiales de construcción", "Zinc arquitectónico")).toBe(
      "materiales-de-construccion-zinc-arquitectonico",
    );
  });
});

describe("buildNecesidadId", () => {
  it("joins centre and item with an underscore, like buildTurnoId does", () => {
    expect(buildNecesidadId("cruz-roja", "alimentos-arroz-blanco")).toBe(
      "cruz-roja_alimentos-arroz-blanco",
    );
  });
});

describe("toNecesidadPublica", () => {
  it("colours the badge red when the point needs the item", () => {
    expect(toNecesidadPublica(necesidad({ estado: "SE_NECESITA" }), null).semaforo).toBe("ROJO");
  });

  it("colours the badge green when there is already enough", () => {
    expect(toNecesidadPublica(necesidad({ estado: "SUFICIENTE" }), null).semaforo).toBe("VERDE");
  });

  it("colours the badge grey when the item does not apply to that point", () => {
    expect(toNecesidadPublica(necesidad({ estado: "NO_APLICA" }), null).semaforo).toBe("GRIS");
  });

  it("carries the category-level message through", () => {
    const publica = toNecesidadPublica(necesidad(), "Revisa las fechas de vencimiento.");
    expect(publica.mensaje).toBe("Revisa las fechas de vencimiento.");
  });
});
