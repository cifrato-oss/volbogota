import { afterEach, describe, expect, it, vi } from "vitest";

import {
  filtrarPorTipo,
  horaEnBogota,
  reportoHoy,
  type BancoSangreVista,
  type TipoSangre,
} from "./sangre";

function banco(overrides: Partial<BancoSangreVista> = {}): BancoSangreVista {
  return {
    id: "hospital-el-tunal",
    nombre: "Hospital El Tunal",
    direccion: "Cra. 20 #47B-35 Sur",
    localidad: "Tunjuelito",
    horarioOficial: "7:00 a.m. – 4:00 p.m.",
    linkMaps: null,
    tiposQueRecibe: ["O+", "O-"],
    resumenTipos: "O+, O−",
    recibiendoHoy: true,
    actualizadoEn: "2026-08-14T13:00:00.000Z",
    reportoHoy: true,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("reportoHoy", () => {
  it("has no report when nothing was ever stored", () => {
    expect(reportoHoy(null)).toBe(false);
    expect(reportoHoy(undefined)).toBe(false);
  });

  it("does not treat an unparseable timestamp as today", () => {
    expect(reportoHoy("ayer por la tarde")).toBe(false);
  });

  it("counts a timestamp from the same Bogotá day", () => {
    // 13:00Z is 8:00 a.m. in Bogotá; "now" is that same morning.
    vi.setSystemTime(new Date("2026-08-14T15:00:00.000Z"));
    expect(reportoHoy("2026-08-14T13:00:00.000Z")).toBe(true);
  });

  it("does not count yesterday's report", () => {
    vi.setSystemTime(new Date("2026-08-14T15:00:00.000Z"));
    expect(reportoHoy("2026-08-13T13:00:00.000Z")).toBe(false);
  });

  it("uses Bogotá's day and not UTC's, which differ for five hours nightly", () => {
    // 02:00Z on the 15th is still 9:00 p.m. on the 14th in Bogotá. A report
    // stamped at 8:00 p.m. Bogotá is the same working day for a coordinator,
    // even though UTC has already rolled over.
    vi.setSystemTime(new Date("2026-08-15T02:00:00.000Z"));
    expect(reportoHoy("2026-08-15T01:00:00.000Z")).toBe(true);
    expect(reportoHoy("2026-08-14T13:00:00.000Z")).toBe(true);
  });
});

describe("horaEnBogota", () => {
  it("has nothing to show without a timestamp", () => {
    expect(horaEnBogota(null)).toBeNull();
    expect(horaEnBogota("no es una fecha")).toBeNull();
  });

  it("renders the instant in Bogotá time, not the reader's", () => {
    // A donor checking from abroad must see the hour the bank confirmed its
    // list locally, not that instant translated into their own timezone.
    expect(horaEnBogota("2026-08-14T13:12:00.000Z")).toMatch(/8:12/);
  });
});

describe("filtrarPorTipo", () => {
  const bancos = [
    banco({ id: "recibe", tiposQueRecibe: ["O+", "O-"] }),
    banco({ id: "no-recibe-el-tuyo", tiposQueRecibe: ["AB+"] }),
    banco({ id: "cerrado-hoy", recibiendoHoy: false, tiposQueRecibe: [] }),
    banco({ id: "sin-reporte", reportoHoy: false, tiposQueRecibe: [] }),
  ];

  it("shows every bank when the donor does not know their type", () => {
    expect(filtrarPorTipo(bancos, null)).toHaveLength(4);
  });

  it("keeps the bank that accepts the chosen type", () => {
    const ids = filtrarPorTipo(bancos, "O-").map((b) => b.id);
    expect(ids).toContain("recibe");
  });

  it("drops only the bank that reported today and said it does not take this type", () => {
    const ids = filtrarPorTipo(bancos, "O-").map((b) => b.id);
    expect(ids).not.toContain("no-recibe-el-tuyo");
  });

  it("keeps a bank that has not reported, because nobody has answered yet", () => {
    // Hiding it would tell the donor something the data does not say. The card
    // says "sin reporte hoy" and points at Maps instead.
    const ids = filtrarPorTipo(bancos, "AB-").map((b) => b.id);
    expect(ids).toContain("sin-reporte");
  });

  it("keeps a bank that is closed today, so the donor sees a complete picture", () => {
    const ids = filtrarPorTipo(bancos, "AB-").map((b) => b.id);
    expect(ids).toContain("cerrado-hoy");
  });

  it("never returns a bank the donor cannot be told anything useful about", () => {
    // Every surviving bank either matches, or carries a reason it is still shown.
    for (const tipo of ["O+", "A-", "AB+"] as TipoSangre[]) {
      for (const b of filtrarPorTipo(bancos, tipo)) {
        expect(!b.reportoHoy || !b.recibiendoHoy || b.tiposQueRecibe.includes(tipo)).toBe(true);
      }
    }
  });
});
