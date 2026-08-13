import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeFirestore } from "@/test/firestore-fake";

import type { CrearReservaInput } from "./reservas.schema";

let db = new FakeFirestore();

vi.mock("@/server/db/firestore", () => ({
  COLLECTIONS: {
    centros: "centros",
    turnos: "turnos",
    reservas: "reservas",
    catalogos: "catalogos",
    inscritos: "inscritos",
  },
  getDb: () => db,
}));

const { crearReservaEnTransaccion, hashCelular } = await import("./reservas.repository");

const TURNO_ID = "cruz-roja_2026-08-13_am";

function seedTurno(overrides: Record<string, unknown> = {}, id = TURNO_ID): string {
  db.seed(`turnos/${id}`, {
    centroId: "cruz-roja",
    centroNombre: "Cruz Roja",
    fecha: "2026-08-13",
    diaSemana: "Jueves",
    jornada: "AM",
    horario: { inicio: "08:00", fin: "14:00", etiqueta: "8:00 a.m. - 2:00 p.m." },
    horarioOficialCentro: "24 horas",
    centroActivo: true,
    cuposTotales: 2,
    reservados: 0,
    estado: "ABIERTO",
    coordinador: null,
    ...overrides,
  });

  return id;
}

function input(overrides: Partial<CrearReservaInput> = {}): CrearReservaInput {
  return {
    nombre: "Ana María",
    apellido: "Ramírez Gómez",
    celular: "3001234567",
    edad: 30,
    turnoId: TURNO_ID,
    autorizoDatos: true,
    ...overrides,
  };
}

function reservadosDe(id = TURNO_ID): number {
  return Number(db.peek(`turnos/${id}`)?.reservados);
}

beforeEach(() => {
  db = new FakeFirestore();
});

describe("crearReservaEnTransaccion", () => {
  it("books the seat and increments the shift counter", async () => {
    seedTurno();

    const { reserva, turno } = await crearReservaEnTransaccion(input());

    expect(reserva.codigo).toMatch(/^VB-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    expect(reserva.estado).toBe("RESERVADO");
    expect(reserva.turnoId).toBe(TURNO_ID);
    expect(turno.reservados).toBe(1);
    expect(reservadosDe()).toBe(1);
  });

  it("stores the reservation under its own code, so check-in can look it up directly", async () => {
    seedTurno();

    const { reserva } = await crearReservaEnTransaccion(input());

    expect(db.peek(`reservas/${reserva.codigo}`)).toMatchObject({
      codigo: reserva.codigo,
      celular: "3001234567",
      estado: "RESERVADO",
      checkIn: null,
      checkOut: null,
      horas: null,
    });
  });

  it("locks the phone under its digest, never under the number itself", async () => {
    seedTurno();

    await crearReservaEnTransaccion(input());

    expect(db.peek(`turnos/${TURNO_ID}/inscritos/${hashCelular("3001234567")}`)).toBeDefined();
    expect(db.peek(`turnos/${TURNO_ID}/inscritos/3001234567`)).toBeUndefined();
  });

  it("rejects a shift that does not exist", async () => {
    await expect(crearReservaEnTransaccion(input())).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "El turno no existe.",
    });
  });

  it("rejects a closed shift", async () => {
    seedTurno({ estado: "CERRADO", cuposTotales: 0 });

    await expect(crearReservaEnTransaccion(input())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "El turno no está disponible para inscripción.",
    });
  });

  it("rejects a full shift without touching the counter", async () => {
    seedTurno({ cuposTotales: 2, reservados: 2 });

    await expect(crearReservaEnTransaccion(input())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "El turno ya no tiene cupos disponibles.",
    });
    expect(reservadosDe()).toBe(2);
  });

  it("rejects the same phone twice in the same shift", async () => {
    seedTurno();

    await crearReservaEnTransaccion(input());

    await expect(crearReservaEnTransaccion(input({ nombre: "Otra" }))).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Ya hay una inscripción con este celular en este turno.",
    });
    expect(reservadosDe()).toBe(1);
  });

  it("allows the same phone in a different shift", async () => {
    seedTurno();
    const otro = seedTurno({}, "cruz-roja_2026-08-14_pm");

    await crearReservaEnTransaccion(input());
    await crearReservaEnTransaccion(input({ turnoId: otro }));

    expect(reservadosDe()).toBe(1);
    expect(reservadosDe(otro)).toBe(1);
  });

  it("refuses to reuse a confirmation code rather than handing out a duplicate", async () => {
    seedTurno();
    // The id is drawn at random, so the only way to hit the collision branch is
    // to make every reservation document read as already taken.
    db.forceExists("reservas");

    await expect(crearReservaEnTransaccion(input())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "No pudimos generar tu código de confirmación. Intenta de nuevo.",
    });
    expect(reservadosDe()).toBe(0);
  });
});

describe("crearReservaEnTransaccion bajo concurrencia", () => {
  it("gives the last seat to exactly one of two simultaneous requests", async () => {
    seedTurno({ cuposTotales: 1 });

    const resultados = await Promise.allSettled([
      crearReservaEnTransaccion(input({ celular: "3001111111" })),
      crearReservaEnTransaccion(input({ celular: "3002222222" })),
    ]);

    const exitosas = resultados.filter((r) => r.status === "fulfilled");
    const fallidas = resultados.filter((r) => r.status === "rejected");

    expect(exitosas).toHaveLength(1);
    expect(fallidas).toHaveLength(1);
    expect(reservadosDe()).toBe(1);

    // The loser must be told the shift filled up, not handed a generic failure:
    // the front end reloads shifts on this message.
    expect(fallidas[0]).toMatchObject({
      reason: { code: "CONFLICT", message: "El turno ya no tiene cupos disponibles." },
    });
  });

  it("never oversells when far more requests arrive than there are seats", async () => {
    const CUPOS = 3;
    const ASPIRANTES = 12;
    seedTurno({ cuposTotales: CUPOS });

    const resultados = await Promise.allSettled(
      Array.from({ length: ASPIRANTES }, (_, i) =>
        crearReservaEnTransaccion(input({ celular: `30012345${String(10 + i)}` })),
      ),
    );

    const exitosas = resultados.filter((r) => r.status === "fulfilled");

    expect(exitosas).toHaveLength(CUPOS);
    expect(reservadosDe()).toBe(CUPOS);
    expect(reservadosDe()).toBeLessThanOrEqual(CUPOS);

    // Every rejection is an answer the caller can act on, not a crash.
    for (const fallida of resultados.filter((r) => r.status === "rejected")) {
      expect(["CONFLICT", "SERVICE_UNAVAILABLE"]).toContain(fallida.reason.code);
    }
  });

  it("issues a distinct code to every winner", async () => {
    seedTurno({ cuposTotales: 5 });

    const resultados = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        crearReservaEnTransaccion(input({ celular: `30055555${String(10 + i)}` })),
      ),
    );

    const codigos = new Set(resultados.map((r) => r.reserva.codigo));

    expect(codigos.size).toBe(5);
    expect(db.pathsIn("reservas")).toHaveLength(5);
  });

  // The repository backs off exponentially before giving up; the last ceiling is
  // ~1.9 s, so the full sequence needs more than the default timeout.
  it(
    "surfaces a retryable 503 when a shift stays contended after backing off",
    { timeout: 15_000 },
    async () => {
      seedTurno();
      // Every commit aborts: the shift is saturated beyond what backoff can drain.
      db.alwaysAbort = true;

      await expect(crearReservaEnTransaccion(input())).rejects.toMatchObject({
        code: "SERVICE_UNAVAILABLE",
      });
      expect(reservadosDe()).toBe(0);
    },
  );
});
