import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Centro, Turno } from "./catalogo.schema";

const findCentros = vi.fn<() => Promise<Centro[]>>();
const findCentroById = vi.fn<(id: string) => Promise<Centro | null>>();
const findTurnos = vi.fn<() => Promise<Turno[]>>();

vi.mock("./catalogo.repository", () => ({
  findCentros: () => findCentros(),
  findCentroById: (id: string) => findCentroById(id),
  findTurnos: () => findTurnos(),
  findTurnoById: vi.fn(),
}));

const { listarCentros, listarTurnos, obtenerCentro } = await import("./catalogo.service");

const centro: Centro = {
  id: "vive-claro",
  nombre: "Vive Claro",
  direccion: "Cra. 60 #42-41",
  localidad: "Teusaquillo",
  linkMaps: null,
  horarioOficial: "8:00 a.m. - 9:00 p.m.",
  observaciones: null,
  actividades: ["Empaque", "Clasificación", "Carga y descarga"],
  cuposPorJornada: { AM: 300, PM: 300, NOCHE: 300 },
  activo: true,
  coordinador: { nombre: "Ana Ramírez", celular: "3001112233" },
};

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

beforeEach(() => {
  vi.clearAllMocks();
  findCentros.mockResolvedValue([centro]);
  findCentroById.mockResolvedValue(centro);
  findTurnos.mockResolvedValue([turno()]);
});

describe("listarCentros", () => {
  it("never exposes the coordinator's contact details publicly", async () => {
    const [publico] = await listarCentros();

    expect(publico).not.toHaveProperty("coordinador");
    expect(JSON.stringify(publico)).not.toContain("3001112233");
  });
});

describe("obtenerCentro", () => {
  it("treats an inactive centre as missing", async () => {
    findCentroById.mockResolvedValue({ ...centro, activo: false });

    await expect(obtenerCentro("vive-claro")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("fails when the centre does not exist", async () => {
    findCentroById.mockResolvedValue(null);

    await expect(obtenerCentro("no-existe")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("listarTurnos", () => {
  it("keeps full and closed shifts by default", async () => {
    findTurnos.mockResolvedValue([
      turno({ id: "a", reservados: 300 }),
      turno({ id: "b", estado: "CERRADO" }),
      turno({ id: "c" }),
    ]);

    expect(await listarTurnos()).toHaveLength(3);
  });

  it("drops them when only availability is asked for", async () => {
    findTurnos.mockResolvedValue([
      turno({ id: "a", reservados: 300 }),
      turno({ id: "b", estado: "CERRADO" }),
      turno({ id: "c" }),
    ]);

    const disponibles = await listarTurnos({ soloDisponibles: true });

    expect(disponibles.map((t) => t.id)).toEqual(["c"]);
  });
});
