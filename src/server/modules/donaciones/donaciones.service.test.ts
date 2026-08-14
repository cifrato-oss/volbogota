import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Centro } from "@/server/modules/catalogo/catalogo.schema";

import type { ElementoDonacion, Necesidad } from "./donaciones.schema";

const findCentroById = vi.fn<(id: string) => Promise<Centro | null>>();
const findElementos = vi.fn<(categoria?: string) => Promise<ElementoDonacion[]>>();
const findNecesidadesPorCentro = vi.fn<(centroId: string) => Promise<Necesidad[]>>();
const guardarNecesidad = vi.fn<(necesidad: Necesidad) => Promise<void>>();

vi.mock("@/server/modules/catalogo/catalogo.repository", () => ({
  findCentroById: (id: string) => findCentroById(id),
}));

vi.mock("./donaciones.repository", () => ({
  findElementos: (categoria?: string) => findElementos(categoria),
  findNecesidadesPorCentro: (centroId: string) => findNecesidadesPorCentro(centroId),
  guardarNecesidad: (necesidad: Necesidad) => guardarNecesidad(necesidad),
}));

const { actualizarEstadoNecesidad, listarNecesidadesDeCentro } =
  await import("./donaciones.service");

const centro: Centro = {
  id: "cruz-roja",
  nombre: "Cruz Roja",
  direccion: "Carrera 24 # 73-38",
  localidad: "Barrios Unidos",
  linkMaps: null,
  horarioOficial: "24 horas",
  observaciones: null,
  actividades: [],
  cuposPorJornada: { AM: 150, PM: 150 },
  activo: true,
  coordinador: null,
};

const arroz: ElementoDonacion = {
  id: "alimentos-arroz-blanco",
  categoria: "Alimentos",
  orden: 1,
  nombre: "Arroz blanco",
  mensaje: "Revisa las fechas de vencimiento.",
};

const jabon: ElementoDonacion = {
  id: "aseo-jabon-de-bano",
  categoria: "Aseo",
  orden: 1,
  nombre: "Jabón de baño",
  mensaje: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  findCentroById.mockResolvedValue(centro);
  findElementos.mockImplementation(async (categoria?: string) =>
    categoria
      ? [arroz, jabon].filter((elemento) => elemento.categoria === categoria)
      : [arroz, jabon],
  );
  findNecesidadesPorCentro.mockResolvedValue([]);
});

describe("listarNecesidadesDeCentro", () => {
  it("fails when the centre does not exist or is inactive", async () => {
    findCentroById.mockResolvedValue(null);
    await expect(listarNecesidadesDeCentro("no-existe")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    findCentroById.mockResolvedValue({ ...centro, activo: false });
    await expect(listarNecesidadesDeCentro("cruz-roja")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("groups every category with its own items, defaulting to SE_NECESITA", async () => {
    const resultado = await listarNecesidadesDeCentro("cruz-roja");

    expect(resultado.centroId).toBe("cruz-roja");
    expect(resultado.categorias).toHaveLength(9); // the nine fixed categories, even when empty

    const alimentos = resultado.categorias.find((c) => c.categoria === "Alimentos");
    expect(alimentos).toMatchObject({
      mensaje: "Revisa las fechas de vencimiento.",
      necesita: true,
    });
    expect(alimentos?.elementos).toMatchObject([
      {
        elementoId: "alimentos-arroz-blanco",
        estado: "SE_NECESITA",
        semaforo: "ROJO",
        actualizadoEn: null,
      },
    ]);

    const construccion = resultado.categorias.find((c) => c.categoria === "Construcción");
    expect(construccion).toMatchObject({ necesita: false, elementos: [] });
  });

  it("marks a category as not needing anything once every item is SUFICIENTE or NO_APLICA", async () => {
    findNecesidadesPorCentro.mockResolvedValue([
      {
        id: "cruz-roja_alimentos-arroz-blanco",
        centroId: "cruz-roja",
        centroNombre: "Cruz Roja",
        elementoId: "alimentos-arroz-blanco",
        categoria: "Alimentos",
        elemento: "Arroz blanco",
        estado: "SUFICIENTE",
        actualizadoEn: "2026-08-13T08:00:00.000Z",
      },
    ]);

    const resultado = await listarNecesidadesDeCentro("cruz-roja");
    const alimentos = resultado.categorias.find((c) => c.categoria === "Alimentos");

    expect(alimentos).toMatchObject({ necesita: false });
    expect(alimentos?.elementos[0]).toMatchObject({ estado: "SUFICIENTE", semaforo: "VERDE" });
  });

  it("returns only the requested category when filtered", async () => {
    const resultado = await listarNecesidadesDeCentro("cruz-roja", { categoria: "Alimentos" });

    expect(resultado.categorias).toHaveLength(1);
    expect(resultado.categorias[0]?.categoria).toBe("Alimentos");
    expect(findElementos).toHaveBeenCalledWith("Alimentos");
  });
});

describe("actualizarEstadoNecesidad", () => {
  it("upserts the pair even when the sheet never set it before", async () => {
    const resultado = await actualizarEstadoNecesidad(
      "cruz-roja_alimentos-arroz-blanco",
      "SUFICIENTE",
    );

    expect(resultado).toMatchObject({ estado: "SUFICIENTE", semaforo: "VERDE" });
    expect(guardarNecesidad).toHaveBeenCalledWith(
      expect.objectContaining({ centroId: "cruz-roja", elementoId: "alimentos-arroz-blanco" }),
    );
  });

  it("fails when the centre in the id does not exist", async () => {
    findCentroById.mockResolvedValue(null);

    await expect(
      actualizarEstadoNecesidad("no-existe_alimentos-arroz-blanco", "SUFICIENTE"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("fails when the item in the id is not in the catalogue", async () => {
    await expect(
      actualizarEstadoNecesidad("cruz-roja_no-existe", "SUFICIENTE"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
