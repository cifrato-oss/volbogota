import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Reserva } from "@/server/modules/reservas/reservas.schema";

const envMock = {
  sheetsWebhookUrl: "https://script.google.com/macros/s/abc/exec" as string | null,
  sheetsHookToken: "un-token-compartido-de-mas-de-32-caracteres" as string | null,
};

vi.mock("@/server/config/env", () => ({
  env: envMock,
  isProduction: false,
  isDevelopment: true,
  isTest: true,
}));

const { empujarReservasAlSheet } = await import("./sheets.outbound");

function reserva(overrides: Partial<Reserva> = {}): Reserva {
  return {
    id: "VB-K7M2QX9D",
    codigo: "VB-K7M2QX9D",
    turnoId: "punto-usaquen_2026-08-13_am",
    centroId: "punto-usaquen",
    centroNombre: "Punto Usaquén",
    fecha: "2026-08-13",
    jornada: "PM",
    nombre: "Ana María",
    apellido: "Ramírez Gómez",
    celular: "3001234567",
    edad: 30,
    autorizoDatos: true,
    contactoEmergencia: null,
    eps: null,
    estado: "ASISTIO",
    creadoEn: "2026-08-13T14:05:00.000Z",
    checkIn: "08:05",
    checkOut: "14:00",
    horas: 5.92,
    ...overrides,
  };
}

function respuestaOk() {
  return new Response(JSON.stringify({ success: true, data: { escritas: 1 } }), { status: 200 });
}

/** The URL and parsed body of the single call the push should have made. */
function loEnviado(fetchMock: { mock: { calls: unknown[][] } }) {
  const llamada = fetchMock.mock.calls[0];
  if (!llamada) throw new Error("No se llamó a fetch.");

  const [url, init] = llamada as [string, { body: string }];
  return { url, cuerpo: JSON.parse(init.body) };
}

beforeEach(() => {
  envMock.sheetsWebhookUrl = "https://script.google.com/macros/s/abc/exec";
  envMock.sheetsHookToken = "un-token-compartido-de-mas-de-32-caracteres";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("empujarReservasAlSheet", () => {
  it("carries the emergency phone and the EPS to their own columns", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk());
    vi.stubGlobal("fetch", fetchMock);

    await empujarReservasAlSheet([reserva({ contactoEmergencia: "601 555 4433", eps: "Sanitas" })]);

    // Apps Script writes these into `Cel. emergencia` and `EPS`, columns S and T.
    expect(loEnviado(fetchMock).cuerpo.reservas[0]).toMatchObject({
      celEmergencia: "601 555 4433",
      eps: "Sanitas",
    });
  });

  it("sends an empty cell for a booking taken before the columns existed", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk());
    vi.stubGlobal("fetch", fetchMock);

    await empujarReservasAlSheet([reserva()]);

    // `escribirCelda` skips empty values, so the coordinator's own text survives.
    expect(loEnviado(fetchMock).cuerpo.reservas[0]).toMatchObject({ celEmergencia: "", eps: "" });
  });

  it("sends the row in the shapes the sheet reads, not ours", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk());
    vi.stubGlobal("fetch", fetchMock);

    await empujarReservasAlSheet([reserva()]);

    const { url, cuerpo: body } = loEnviado(fetchMock);

    expect(url).toBe("https://script.google.com/macros/s/abc/exec");
    expect(body.token).toBe("un-token-compartido-de-mas-de-32-caracteres");
    expect(body.reservas[0]).toMatchObject({
      codigo: "VB-K7M2QX9D",
      nombreCompleto: "Ana María Ramírez Gómez",
      // The sheet writes dates day-first and shifts with pipes and a label.
      fechaJornada: "13/08/2026",
      jornada: "PM",
      idTurno: "Punto Usaquén|2026-08-13|PM",
      autorizoDatos: "Sí",
      estado: "Asistió",
    });
  });

  it("writes hours with a comma, the decimal separator the sheet's locale uses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk());
    vi.stubGlobal("fetch", fetchMock);

    await empujarReservasAlSheet([reserva()]);

    // A dot would read as a thousands separator and turn 5.92 into 592.
    expect(loEnviado(fetchMock).cuerpo.reservas[0].horas).toBe("5,92");
  });

  it("stamps the registration time in Bogotá, not UTC", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk());
    vi.stubGlobal("fetch", fetchMock);

    await empujarReservasAlSheet([reserva()]);

    expect(loEnviado(fetchMock).cuerpo.reservas[0].fechaRegistro).toBe("13/08/2026 09:05");
  });

  it("leaves check-in and check-out empty rather than sending null into a cell", async () => {
    const fetchMock = vi.fn().mockResolvedValue(respuestaOk());
    vi.stubGlobal("fetch", fetchMock);

    await empujarReservasAlSheet([reserva({ checkIn: null, checkOut: null, horas: null })]);

    expect(loEnviado(fetchMock).cuerpo.reservas[0]).toMatchObject({
      checkIn: "",
      checkOut: "",
      horas: "",
    });
  });

  it("reports a failure instead of throwing it at the booking", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 500 })));

    const resultado = await empujarReservasAlSheet([reserva()]);

    expect(resultado.ok).toBe(false);
    expect(resultado.error).toMatch(/500/);
  });

  it("does not call a 200 a success when the script wrote nothing", async () => {
    // A deployment made from a version without doPost answers 200 with Google's
    // own HTML. Trusting the status reported rows as written that never were.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<!DOCTYPE html><html>...", { status: 200 })),
    );

    const resultado = await empujarReservasAlSheet([reserva()]);

    expect(resultado.ok).toBe(false);
    expect(resultado.enviadas).toBe(0);
    expect(resultado.error).toMatch(/doPost/);
  });

  it("relays the reason the script gave for refusing", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ success: false, error: "Token inválido." })),
        ),
    );

    const resultado = await empujarReservasAlSheet([reserva()]);

    expect(resultado).toMatchObject({ ok: false, error: "Token inválido." });
  });

  it("survives the network being down", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const resultado = await empujarReservasAlSheet([reserva()]);

    expect(resultado.ok).toBe(false);
    expect(resultado.enviadas).toBe(0);
  });

  it("does nothing, and says nothing went wrong, when no sheet is wired up", async () => {
    // A deployment without the script is not misconfigured; it just has no
    // sheet yet, and a booking there must not look like a failure.
    envMock.sheetsWebhookUrl = null;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await empujarReservasAlSheet([reserva()]);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(resultado).toEqual({ enviadas: 0, ok: true, error: null });
  });

  it("does not call out for an empty batch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await empujarReservasAlSheet([]);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
