import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SincronizarBancosSangreInput } from "@/server/modules/sheets/sheets.schema";

import type { BancoSangre } from "./sangre.schema";

const guardarBancosEnLote = vi.fn<(bancos: BancoSangre[]) => Promise<void>>();
const desactivarBancosAusentes = vi.fn<(ids: string[]) => Promise<number>>();
const findBancos = vi.fn<(activo?: boolean) => Promise<BancoSangre[]>>();

vi.mock("./sangre.repository", () => ({
  guardarBancosEnLote: (bancos: BancoSangre[]) => guardarBancosEnLote(bancos),
  desactivarBancosAusentes: (ids: string[]) => desactivarBancosAusentes(ids),
  findBancos: (activo?: boolean) => findBancos(activo),
}));

const { sincronizarBancosDesdeSheet } = await import("./sangre.service");

type Fila = SincronizarBancosSangreInput["filas"][number];

function fila(overrides: Partial<Fila> = {}): Fila {
  return {
    bancoDeSangre: "Hospital El Tunal",
    direccion: "Cra. 20 #47B-35 Sur",
    localidad: "Tunjuelito",
    horarioOficial: "7:00 a.m. – 4:00 p.m.",
    linkMaps: null,
    tipoDeSangre: "O+, RH-",
    recibiendoHoy: "Sí",
    activo: "Sí",
    ...overrides,
  } as Fila;
}

async function sincronizar(filas: Fila[]) {
  await sincronizarBancosDesdeSheet({ filas } as SincronizarBancosSangreInput);
  return guardarBancosEnLote.mock.calls[0]![0];
}

beforeEach(() => {
  vi.clearAllMocks();
  desactivarBancosAusentes.mockResolvedValue(0);
  guardarBancosEnLote.mockResolvedValue();
});

describe("sincronizarBancosDesdeSheet", () => {
  it("expands the coordinator's shorthand and keeps their wording beside it", async () => {
    const [banco] = await sincronizar([fila()]);
    expect(banco!.tiposQueRecibe).toEqual(["O+", "O-", "A-", "B-", "AB-"]);
    // The card shows a person's words; the filter uses the expansion.
    expect(banco!.resumenTipos).toBe("O+, RH-");
  });

  it("stamps every synced row with a fresh actualizadoEn", async () => {
    // The whole point of the module: the front derives "sin reporte hoy" from
    // this timestamp, so confirming an unchanged list still has to land.
    vi.setSystemTime(new Date("2026-08-14T13:00:00.000Z"));
    const [banco] = await sincronizar([fila()]);
    expect(banco!.actualizadoEn).toBe("2026-08-14T13:00:00.000Z");
    vi.useRealTimers();
  });

  it("reads a blank 'Recibiendo hoy' as receiving, not as closed", async () => {
    // An unfilled dropdown is likelier than a closed bank, and turning a donor
    // away is the costlier mistake.
    const [banco] = await sincronizar([fila({ recibiendoHoy: null })]);
    expect(banco!.recibiendoHoy).toBe(true);
  });

  it("honours an explicit No", async () => {
    const [banco] = await sincronizar([fila({ recibiendoHoy: "No" })]);
    expect(banco!.recibiendoHoy).toBe(false);
  });

  it("reads a blank 'Activo' as operating, the same as Centros does", async () => {
    const [banco] = await sincronizar([fila({ activo: null })]);
    expect(banco!.activo).toBe(true);
  });

  it("keys the bank by its name and trims what the cell carried", async () => {
    const [banco] = await sincronizar([fila({ bancoDeSangre: "  IDCBIS  " })]);
    expect(banco!.id).toBe("idcbis");
    expect(banco!.nombre).toBe("IDCBIS");
  });

  it("leaves an unreadable type cell empty rather than guessing", async () => {
    // Distinct from "not receiving": the bank is open, nobody said which types.
    const [banco] = await sincronizar([fila({ tipoDeSangre: "todos los que lleguen" })]);
    expect(banco!.tiposQueRecibe).toEqual([]);
    expect(banco!.recibiendoHoy).toBe(true);
  });

  it("retires the banks the sheet no longer lists", async () => {
    desactivarBancosAusentes.mockResolvedValue(2);

    const resultado = await sincronizarBancosDesdeSheet({
      filas: [fila(), fila({ bancoDeSangre: "IDCBIS" })],
    } as SincronizarBancosSangreInput);

    expect(desactivarBancosAusentes).toHaveBeenCalledWith(["hospital-el-tunal", "idcbis"]);
    expect(resultado).toEqual({ bancos: 2, desactivados: 2 });
  });
});
