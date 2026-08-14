import { beforeEach, describe, expect, it, vi } from "vitest";

import { MemoryFirestore } from "@/server/db/drivers/memory.driver";

let db = new MemoryFirestore();

vi.mock("@/server/db/firestore", () => ({
  COLLECTIONS: {
    centros: "centros",
    turnos: "turnos",
    reservas: "reservas",
    catalogos: "catalogos",
    inscritos: "inscritos",
    catalogoDonaciones: "catalogoDonaciones",
    necesidades: "necesidades",
  },
  getDb: () => db,
}));

const {
  sincronizarCentrosDesdeSheet,
  sincronizarDonacionesDesdeSheet,
  sincronizarReservasDesdeSheet,
  sincronizarTurnosDesdeSheet,
} = await import("./sheets.service");
const {
  sincronizarCentrosSchema,
  sincronizarDonacionesSchema,
  sincronizarReservasSchema,
  sincronizarTurnosSchema,
} = await import("./sheets.schema");

// Through the schema, exactly as the route does: Apps Script sends every cell
// as text, and the coercion is part of what these tests are checking.
function sincronizarCentros(body: unknown) {
  return sincronizarCentrosDesdeSheet(sincronizarCentrosSchema.parse(body));
}

function sincronizarReservas(body: unknown) {
  return sincronizarReservasDesdeSheet(sincronizarReservasSchema.parse(body));
}

function sincronizarTurnos(body: unknown) {
  return sincronizarTurnosDesdeSheet(sincronizarTurnosSchema.parse(body));
}

function sincronizarDonaciones(body: unknown) {
  return sincronizarDonacionesDesdeSheet(sincronizarDonacionesSchema.parse(body));
}

/** A row of the `Donaciones` sheet, as Apps Script reads it. */
function filaDonacion(overrides: Record<string, unknown> = {}) {
  return {
    fila: 5,
    categoria: "Alimentos",
    elemento: "Arroz blanco",
    estados: { "Cruz Roja": "Se necesita" },
    ...overrides,
  };
}

/** A row of the `Turnos` board, as Apps Script reads it. */
function filaTurno(overrides: Record<string, unknown> = {}) {
  return {
    fila: 2,
    puntoDeAcopio: "Punto Usaquén",
    fecha: "13/08/2026",
    jornada: "AM",
    dia: null,
    horario: null,
    estadoCupo: null,
    cuposTotales: "150",
    ...overrides,
  };
}

const FECHAS = ["2026-08-13", "2026-08-14"];

/** A row of the `Centros` sheet, with the defaults the real file carries. */
function filaCentro(overrides: Record<string, unknown> = {}) {
  return {
    puntoDeAcopio: "Punto Usaquén",
    direccion: "Calle 161A # 7F-55",
    localidad: "Usaquén",
    horarioOficial: "8:00 a.m. - 9:00 p.m.",
    cuposAm: "150",
    cuposPm: "150",
    actividades: "Empaque, Clasificación, Carga y descarga",
    linkMaps: "https://maps.app.goo.gl/ShUjA6o1j2WcVUPp9",
    activo: "Sí",
    observaciones: null,
    ...overrides,
  };
}

function filaReserva(overrides: Record<string, unknown> = {}) {
  return {
    fila: 2,
    codigo: null,
    nombreCompleto: "Fulanita Pérez Gómez",
    celular: "3001234567",
    edad: null,
    idTurno: "Punto Usaquén|2026-08-13|AM",
    puntoDeAcopio: null,
    fechaJornada: null,
    jornada: null,
    autorizoDatos: "Sí",
    asistencia: null,
    estado: null,
    checkIn: null,
    checkOut: null,
    ...overrides,
  };
}

beforeEach(() => {
  db = new MemoryFirestore();
});

describe("sincronizarCentrosDesdeSheet", () => {
  it("writes the point, and does not invent shifts for it", async () => {
    const resultado = await sincronizarCentros({ filas: [filaCentro()] });

    expect(resultado.centros).toBe(1);

    expect(db.peek("centros/punto-usaquen")).toMatchObject({
      nombre: "Punto Usaquén",
      localidad: "Usaquén",
      cuposPorJornada: { AM: 150, PM: 150, TARDE: 0, MADRUGADA: 0, NOCHE: 0 },
      activo: true,
    });

    // Capacity here is nominal and informative: only the board makes a shift.
    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toBeUndefined();
  });

  it("carries every capacity column the sheet now has", async () => {
    await sincronizarCentros({
      filas: [filaCentro({ cuposTarde: "200", cuposMadrugada: "50" })],
    });

    expect(db.peek("centros/punto-usaquen")?.cuposPorJornada).toMatchObject({
      AM: 150,
      TARDE: 200,
      PM: 150,
      MADRUGADA: 50,
    });
  });

  it("refuses a batch with no actual points", async () => {
    await expect(
      sincronizarCentros({ filas: [filaCentro({ puntoDeAcopio: "TOTAL" })] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("skips the totals row and the footnotes under the table", async () => {
    const resultado = await sincronizarCentros({
      filas: [
        filaCentro(),
        filaCentro({ puntoDeAcopio: "TOTAL", cuposAm: "1,050" }),
        filaCentro({ puntoDeAcopio: "SUPUESTO: los cupos por jornada los puse yo" }),
        filaCentro({ puntoDeAcopio: "Un cupo en 0 desactiva ese turno" }),
      ],
    });

    expect(resultado.centros).toBe(1);
    expect(db.peek("centros/total")).toBeUndefined();
  });

  it("drops activities that are not in the closed set instead of failing", async () => {
    await sincronizarCentros({
      filas: [filaCentro({ actividades: "Empaque, Logística, Clasificación" })],
    });

    expect(db.peek("centros/punto-usaquen")?.actividades).toEqual(["Empaque", "Clasificación"]);
  });

  it("retires a point that disappeared from the sheet without deleting it", async () => {
    await sincronizarCentros({
      filas: [filaCentro(), filaCentro({ puntoDeAcopio: "Cruz Roja" })],
    });

    const resultado = await sincronizarCentros({ filas: [filaCentro()] });

    expect(resultado.desactivados).toEqual(["cruz-roja"]);
    // Kept, not deleted: reservations still point at its shifts.
    expect(db.peek("centros/cruz-roja")).toMatchObject({ activo: false });
  });

  it("leaves the board's capacity alone — that is the whole point of the split", async () => {
    await sincronizarCentros({ filas: [filaCentro()] });
    await sincronizarTurnos({ filas: [filaTurno({ cuposTotales: "300" })] });

    await sincronizarCentros({ filas: [filaCentro({ cuposAm: "80" })] });

    // Editing a nominal figure in `Centros` used to rebuild every shift and
    // flatten the 300 the board had authorised back to the centre's number.
    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ cuposTotales: 300 });
    expect(db.peek("centros/punto-usaquen")).toMatchObject({
      cuposPorJornada: expect.objectContaining({ AM: 80 }),
    });
  });

  it("re-stamps on the board the centre fields each shift copies", async () => {
    await sincronizarCentros({ filas: [filaCentro()] });
    await sincronizarTurnos({ filas: [filaTurno({ cuposTotales: "300" })] });

    await sincronizarCentros({ filas: [filaCentro({ activo: "No" })] });

    // Retiring a point has to reach its shifts, or the board keeps offering it.
    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({
      centroActivo: false,
      estado: "CERRADO",
    });
  });
});

describe("sincronizarTurnosDesdeSheet", () => {
  beforeEach(async () => {
    await sincronizarCentros({ filas: [filaCentro()] });
  });

  it("lets the board authorise more capacity than the point's nominal figure", async () => {
    // This is the whole point of the board: 300 on Thursday at a point whose
    // `Centros` row says 150, without touching the other days.
    const resultado = await sincronizarTurnos({
      filas: [
        filaTurno({ fila: 2, cuposTotales: "300" }),
        filaTurno({ fila: 3, fecha: "14/08/2026", cuposTotales: "150" }),
      ],
    });

    expect(resultado.rechazadas).toEqual([]);
    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ cuposTotales: 300 });
    expect(db.peek("turnos/punto-usaquen_2026-08-14_am")).toMatchObject({ cuposTotales: 150 });
  });

  it("closes a shift whose row the board stopped listing", async () => {
    await sincronizarTurnos({ filas: [filaTurno({ cuposTotales: "300" })] });

    // The row is gone from the board; another row keeps the batch non-empty.
    await sincronizarTurnos({ filas: [filaTurno({ jornada: "PM", cuposTotales: "150" })] });

    // Closed, not deleted: a reservation may still point at it. The capacity
    // survives — zeroing it threw away what the shift held.
    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({
      estado: "CERRADO",
      cuposTotales: 300,
    });
  });

  it("opens a night the point's nominal capacity leaves closed", async () => {
    await sincronizarTurnos({
      filas: [filaTurno({ jornada: "Noche", cuposTotales: "80", horario: "7 p.m. a 11 p.m." })],
    });

    expect(db.peek("turnos/punto-usaquen_2026-08-13_noche")).toMatchObject({
      cuposTotales: 80,
      estado: "ABIERTO",
      horario: { inicio: "19:00", fin: "23:00", etiqueta: "7 p.m. a 11 p.m." },
    });
  });

  it("opens a day the programme's calendar does not cover", async () => {
    const resultado = await sincronizarTurnos({ filas: [filaTurno({ fecha: "20/08/2026" })] });

    expect(resultado.fechas).toContain("2026-08-20");
    expect(db.peek("turnos/punto-usaquen_2026-08-20_am")).toMatchObject({ cuposTotales: 150 });
  });

  it("never wipes bookings already taken", async () => {
    db.seed("turnos/punto-usaquen_2026-08-13_am", {
      ...db.peek("turnos/punto-usaquen_2026-08-13_am"),
      reservados: 40,
    });

    await sincronizarTurnos({ filas: [filaTurno({ cuposTotales: "300" })] });

    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({
      cuposTotales: 300,
      reservados: 40,
    });
  });

  it("applies capacity as written even below what is already booked", async () => {
    db.seed("turnos/punto-usaquen_2026-08-13_am", {
      ...db.peek("turnos/punto-usaquen_2026-08-13_am"),
      reservados: 120,
    });

    await sincronizarTurnos({ filas: [filaTurno({ cuposTotales: "100" })] });

    // Visibly oversold beats silently dropping volunteers who already booked.
    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({
      cuposTotales: 100,
      reservados: 120,
    });
  });

  it("rejects the bad row and applies the rest of the board", async () => {
    const resultado = await sincronizarTurnos({
      filas: [
        filaTurno({ fila: 2, cuposTotales: "300" }),
        filaTurno({ fila: 3, fecha: "13 de agosto" }),
        filaTurno({ fila: 4, jornada: "Madrugada 2" }),
        filaTurno({ fila: 5, jornada: "PM", horario: "por la mañana" }),
      ],
    });

    // Row 4 names a slot the programme invented and states no hours for it.
    expect(resultado.rechazadas.map((r) => r.fila)).toEqual([3, 4, 5]);
    expect(resultado.rechazadas[1]?.motivo).toMatch(/no tiene horario por defecto/i);
    expect(resultado.rechazadas[0]?.motivo).toMatch(/no entiendo la fecha/i);
    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ cuposTotales: 300 });
  });

  it("names the row whose point is not in the catalogue", async () => {
    const resultado = await sincronizarTurnos({
      filas: [filaTurno(), filaTurno({ fila: 7, puntoDeAcopio: "Estadio El Campin" })],
    });

    expect(resultado.rechazadas).toEqual([
      { fila: 7, motivo: expect.stringContaining("estadio-el-campin") },
    ]);
  });

  it("refuses a batch in which no row could be read", async () => {
    await expect(
      sincronizarTurnos({ filas: [filaTurno({ jornada: "Madrugada 2" })] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("opens a slot the programme invented, given its own hours", async () => {
    await sincronizarTurnos({
      filas: [filaTurno({ jornada: "Madrugada 2", horario: "10 p. m. a 2 a. m." })],
    });

    expect(db.peek("turnos/punto-usaquen_2026-08-13_madrugada-2")).toMatchObject({
      jornada: "MADRUGADA 2",
      horario: { inicio: "22:00", fin: "02:00" },
      estado: "ABIERTO",
    });
  });

  it("reads a formula row and a hard-typed row from the same column", async () => {
    // The sheet sends computed values, so `Cupos totales` carries the figure
    // looked up in `Centros` and the one typed over it without distinction.
    await sincronizarTurnos({
      filas: [
        filaTurno({ fila: 2, cuposTotales: "150" }), // = INDEX(Centros!…)
        filaTurno({ fila: 3, fecha: "14/08/2026", cuposTotales: "400" }), // typed over
      ],
    });

    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ cuposTotales: 150 });
    expect(db.peek("turnos/punto-usaquen_2026-08-14_am")).toMatchObject({ cuposTotales: 400 });
  });

  it("keeps two madrugada slots on the same night apart", async () => {
    // Straight from the live board: `MADRUGADA 1` is its own shift, not a
    // misspelling of `MADRUGADA`, and both can run on the same date.
    await sincronizarTurnos({
      filas: [
        filaTurno({
          fila: 2,
          fecha: "16/08/2026",
          jornada: "MADRUGADA 1",
          horario: "12:00 a. m. – 4:00 a. m.",
        }),
        filaTurno({
          fila: 3,
          fecha: "16/08/2026",
          jornada: "MADRUGADA",
          horario: "10:00 p. m. – 5:00 a.m.",
          dia: "Sábado-Domingo",
        }),
      ],
    });

    expect(db.peek("turnos/punto-usaquen_2026-08-16_madrugada-1")).toMatchObject({
      jornada: "MADRUGADA 1",
      horario: { inicio: "00:00", fin: "04:00" },
    });

    // The board's own label, verbatim: a shift that starts one night and ends
    // the next morning spans two days, which the date alone cannot say.
    expect(db.peek("turnos/punto-usaquen_2026-08-16_madrugada")).toMatchObject({
      jornada: "MADRUGADA",
      horario: { inicio: "22:00", fin: "05:00" },
      diaSemana: "Sábado-Domingo",
    });
  });

  it("derives the weekday only when the board leaves Día empty", async () => {
    await sincronizarTurnos({ filas: [filaTurno({ fecha: "16/08/2026", dia: null })] });

    expect(db.peek("turnos/punto-usaquen_2026-08-16_am")).toMatchObject({ diaSemana: "Domingo" });
  });

  it("keeps a shift open when Estado del cupo is blank but there is capacity", async () => {
    // The column is a formula and it is not dragged to the bottom of the board:
    // most rows are blank while holding perfectly good shifts.
    await sincronizarTurnos({ filas: [filaTurno({ estadoCupo: null })] });

    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ estado: "ABIERTO" });
  });

  it("honours the affirmative spellings the board actually uses", async () => {
    for (const valor of ["Abierto", "open", "Sí", "Disponible"]) {
      await sincronizarTurnos({ filas: [filaTurno({ estadoCupo: valor })] });
      expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ estado: "ABIERTO" });
    }
  });

  it("closes the shift when the board says so, whatever the capacity", async () => {
    await sincronizarTurnos({ filas: [filaTurno({ estadoCupo: "Cerrado", cuposTotales: "300" })] });

    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({
      estado: "CERRADO",
      cuposTotales: 300,
    });
  });

  it("does not let a derived 'Sin cupos' freeze a full shift shut", async () => {
    // It comes from `Disponibles` hitting zero, not from a decision. Honouring
    // it would mean a cancellation could never reopen the shift.
    await sincronizarTurnos({ filas: [filaTurno({ estadoCupo: "Sin cupos" })] });

    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ estado: "ABIERTO" });
  });

  it("reports a board row naming a point the catalogue does not have", async () => {
    const resultado = await sincronizarTurnos({
      filas: [filaTurno(), filaTurno({ fila: 9, puntoDeAcopio: "Estadio El Campin" })],
    });

    expect(resultado.rechazadas).toEqual([
      { fila: 9, motivo: expect.stringContaining("estadio-el-campin") },
    ]);
  });

  it("keeps a retired point's shifts closed whatever the board says", async () => {
    await sincronizarCentros({ filas: [filaCentro({ activo: "No" })], fechas: FECHAS });

    await sincronizarTurnos({ filas: [filaTurno({ cuposTotales: "300" })] });

    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({
      centroActivo: false,
      estado: "CERRADO",
    });
  });
});

describe("sincronizarReservasDesdeSheet", () => {
  beforeEach(async () => {
    await sincronizarCentros({ filas: [filaCentro()] });
    // The board is the only thing that creates a bookable shift now.
    await sincronizarTurnos({
      filas: FECHAS.flatMap((fecha, i) =>
        ["AM", "PM"].map((jornada, j) => ({
          ...filaTurno({ fila: 2 + i * 2 + j, jornada }),
          fecha,
        })),
      ),
    });
  });

  it("creates the reservation a coordinator typed by hand and answers with its code", async () => {
    const { resultados, creadas } = await sincronizarReservas({
      filas: [filaReserva()],
    });

    expect(creadas).toBe(1);
    expect(resultados[0]).toMatchObject({
      fila: 2,
      validacion: "OK",
      estado: "Reservado",
      creada: true,
    });
    expect(resultados[0]?.codigo).toMatch(/^VB-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);

    // It went through the booking transaction, so the seat is actually taken.
    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ reservados: 1 });
  });

  it("defaults the age to the legal minimum, which the sheet does not carry", async () => {
    // Omitted entirely, not sent as null: the sheet has no such column, so
    // Apps Script never puts the key in the payload.
    const { resultados } = await sincronizarReservas({
      filas: [
        {
          fila: 2,
          nombreCompleto: "Fulanita Pérez Gómez",
          celular: "3001234567",
          idTurno: "Punto Usaquén|2026-08-13|AM",
          autorizoDatos: "Sí",
        },
      ],
    });
    const codigo = resultados[0]?.codigo ?? "";

    expect(resultados[0]?.validacion).toBe("OK");
    expect(db.peek(`reservas/${codigo}`)).toMatchObject({ edad: 18 });
  });

  it("splits the sheet's single name column into the two fields we store", async () => {
    const { resultados } = await sincronizarReservas({ filas: [filaReserva()] });
    const codigo = resultados[0]?.codigo ?? "";

    expect(db.peek(`reservas/${codigo}`)).toMatchObject({
      nombre: "Fulanita",
      apellido: "Pérez Gómez",
    });
  });

  it("refuses a row without consent and says why, without writing anything", async () => {
    const { resultados, creadas } = await sincronizarReservas({
      filas: [filaReserva({ autorizoDatos: "No" })],
    });

    expect(creadas).toBe(0);
    // The message itself, not a serialised issue object: this lands in a cell.
    expect(resultados[0]?.validacion).toBe("Debes autorizar el tratamiento de datos personales.");
    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ reservados: 0 });
  });

  it("recovers the code when a row comes back without one, instead of bouncing off the lock", async () => {
    // The sheet keeps working while Firestore is unavailable, so a row can
    // arrive again with nothing written back. Reporting "already enrolled"
    // would leave that row without its code forever.
    const primera = await sincronizarReservas({ filas: [filaReserva()] });
    const codigo = primera.resultados[0]?.codigo;

    const { resultados, creadas, actualizadas } = await sincronizarReservas({
      filas: [filaReserva({ codigo: null })],
    });

    expect(creadas).toBe(0);
    expect(actualizadas).toBe(1);
    expect(resultados[0]?.validacion).toBe("OK");
    expect(resultados[0]?.codigo).toBe(codigo);
    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ reservados: 1 });
  });

  it("keeps converging however many times the same row is resent", async () => {
    await sincronizarReservas({ filas: [filaReserva()] });
    await sincronizarReservas({ filas: [filaReserva({ codigo: null })] });
    const { resultados } = await sincronizarReservas({ filas: [filaReserva({ codigo: null })] });

    expect(resultados[0]?.validacion).toBe("OK");
    expect(db.pathsIn("reservas")).toHaveLength(1);
    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ reservados: 1 });
  });

  it("rejects a row for a full shift without taking down the rest of the batch", async () => {
    db.seed("turnos/punto-usaquen_2026-08-13_am", {
      ...db.peek("turnos/punto-usaquen_2026-08-13_am"),
      cuposTotales: 1,
    });

    const { resultados, creadas } = await sincronizarReservas({
      filas: [
        filaReserva({ fila: 2, celular: "3001111111" }),
        filaReserva({ fila: 3, celular: "3002222222" }),
        // A different shift, so this one must still go through.
        filaReserva({
          fila: 4,
          celular: "3003333333",
          idTurno: "Punto Usaquén|2026-08-13|PM",
        }),
      ],
    });

    expect(creadas).toBe(2);
    expect(resultados[0]?.validacion).toBe("OK");
    expect(resultados[1]?.validacion).toBe("El turno ya no tiene cupos disponibles.");
    expect(resultados[2]?.validacion).toBe("OK");
  });

  it("marks a row whose shift does not exist", async () => {
    const { resultados } = await sincronizarReservas({
      filas: [filaReserva({ idTurno: "Punto Inventado|2026-08-13|AM" })],
    });

    expect(resultados[0]?.validacion).toBe("El turno no existe.");
  });

  it("builds the shift from the separate columns when ID_Turno is empty", async () => {
    const { resultados } = await sincronizarReservas({
      filas: [
        filaReserva({
          idTurno: null,
          puntoDeAcopio: "Punto Usaquén",
          fechaJornada: "13/08/2026",
          jornada: "AM",
        }),
      ],
    });

    expect(resultados[0]?.validacion).toBe("OK");
    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ reservados: 1 });
  });

  it("updates the state of a reservation it already knows, instead of creating another", async () => {
    const primera = await sincronizarReservas({ filas: [filaReserva()] });
    const codigo = primera.resultados[0]?.codigo ?? "";

    const { resultados, creadas, actualizadas } = await sincronizarReservas({
      filas: [filaReserva({ codigo, estado: "Confirmado" })],
    });

    expect(creadas).toBe(0);
    expect(actualizadas).toBe(1);
    expect(resultados[0]?.estado).toBe("Confirmado");
    expect(db.peek(`reservas/${codigo}`)).toMatchObject({ estado: "CONFIRMADO" });
  });

  it("marks attendance from a check-in typed at the gate", async () => {
    const primera = await sincronizarReservas({ filas: [filaReserva()] });
    const codigo = primera.resultados[0]?.codigo ?? "";

    const { resultados } = await sincronizarReservas({
      filas: [filaReserva({ codigo, checkIn: "08:05" })],
    });

    expect(resultados[0]?.estado).toBe("Asistió");
    expect(db.peek(`reservas/${codigo}`)).toMatchObject({ checkIn: "08:05", estado: "ASISTIO" });
  });

  it("computes donated hours from a check-out", async () => {
    const primera = await sincronizarReservas({ filas: [filaReserva()] });
    const codigo = primera.resultados[0]?.codigo ?? "";

    await sincronizarReservas({
      filas: [filaReserva({ codigo, checkIn: "08:05", checkOut: "14:00" })],
    });

    expect(db.peek(`reservas/${codigo}`)).toMatchObject({ horas: 5.92 });
  });

  it("releases the seat when the sheet cancels a reservation", async () => {
    const primera = await sincronizarReservas({ filas: [filaReserva()] });
    const codigo = primera.resultados[0]?.codigo ?? "";

    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ reservados: 1 });

    await sincronizarReservas({ filas: [filaReserva({ codigo, estado: "Cancelado" })] });

    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ reservados: 0 });
  });

  it("reports an illegal state change instead of forcing it", async () => {
    const primera = await sincronizarReservas({ filas: [filaReserva()] });
    const codigo = primera.resultados[0]?.codigo ?? "";

    await sincronizarReservas({ filas: [filaReserva({ codigo, estado: "Cancelado" })] });

    const { resultados } = await sincronizarReservas({
      filas: [filaReserva({ codigo, estado: "Asistió" })],
    });

    expect(resultados[0]?.validacion).toMatch(/No se puede pasar de CANCELADO a ASISTIO/);
  });

  it("treats the sheet's own numbering as no code and creates the reservation", async () => {
    // The example row ships with `V-0001`, which is not a code we issued.
    const { resultados, creadas } = await sincronizarReservas({
      filas: [filaReserva({ codigo: "V-0001" })],
    });

    expect(creadas).toBe(1);
    expect(resultados[0]?.codigo).toMatch(/^VB-/);
  });
});

describe("asistencia desde la hoja", () => {
  beforeEach(async () => {
    await sincronizarCentros({ filas: [filaCentro()] });
    await sincronizarTurnos({ filas: [filaTurno()] });
  });

  it.each([
    ["Sí", true],
    ["si", true],
    ["X", true],
    ["No", false],
  ])("reads %s as %s", async (celda, esperado) => {
    const { resultados } = await sincronizarReservas({ filas: [filaReserva()] });
    const codigo = resultados[0]?.codigo ?? "";

    await sincronizarReservas({ filas: [filaReserva({ codigo, asistencia: celda })] });

    expect(db.peek(`reservas/${codigo}`)).toMatchObject({ asistio: esperado });
  });

  it("leaves a blank cell as not marked, which is not the same as absent", async () => {
    const { resultados } = await sincronizarReservas({ filas: [filaReserva()] });
    const codigo = resultados[0]?.codigo ?? "";

    await sincronizarReservas({ filas: [filaReserva({ codigo, asistencia: null })] });

    expect(db.peek(`reservas/${codigo}`)).toMatchObject({ asistio: null });
  });

  it("does not touch the booking's state", async () => {
    // `Estado` and `Asistencia` answer different questions: whether the booking
    // is still valid, and whether the person turned up.
    const { resultados } = await sincronizarReservas({ filas: [filaReserva()] });
    const codigo = resultados[0]?.codigo ?? "";

    await sincronizarReservas({ filas: [filaReserva({ codigo, asistencia: "No" })] });

    expect(db.peek(`reservas/${codigo}`)).toMatchObject({
      asistio: false,
      estado: "RESERVADO",
    });
  });
});

describe("sincronizarDonacionesDesdeSheet", () => {
  beforeEach(async () => {
    await sincronizarCentros({
      filas: [
        filaCentro({ puntoDeAcopio: "Cruz Roja" }),
        filaCentro({ puntoDeAcopio: "CC Unicentro" }),
      ],
    });
  });

  it("writes the need for the point the cell named", async () => {
    const resultado = await sincronizarDonaciones({ filas: [filaDonacion()] });

    expect(resultado.elementos).toBe(1);
    expect(resultado.necesidades).toBe(1);
    expect(resultado.rechazadas).toEqual([]);
    expect(db.peek("necesidades/cruz-roja_alimentos-arroz-blanco")).toMatchObject({
      centroId: "cruz-roja",
      centroNombre: "Cruz Roja",
      categoria: "Alimentos",
      elemento: "Arroz blanco",
      estado: "SE_NECESITA",
    });
  });

  it("derives the catalogue from the same row, since the sheet has no separate Catálogo tab", async () => {
    await sincronizarDonaciones({
      filas: [filaDonacion(), filaDonacion({ fila: 6, elemento: "Frijol" })],
    });

    expect(db.peek("catalogoDonaciones/alimentos-arroz-blanco")).toMatchObject({
      categoria: "Alimentos",
      orden: 0,
      nombre: "Arroz blanco",
      mensaje: null,
    });
    expect(db.peek("catalogoDonaciones/alimentos-frijol")).toMatchObject({
      categoria: "Alimentos",
      orden: 1,
      nombre: "Frijol",
    });
  });

  it("retires an item the sheet stopped naming, and the needs written against it", async () => {
    await sincronizarDonaciones({
      filas: [filaDonacion(), filaDonacion({ fila: 6, elemento: "Frijol" })],
    });
    expect(db.peek("catalogoDonaciones/alimentos-frijol")).toMatchObject({ nombre: "Frijol" });
    expect(db.peek("necesidades/cruz-roja_alimentos-frijol")).toMatchObject({
      estado: "SE_NECESITA",
    });

    // The second sync's row for "Frijol" is gone — deleted from the sheet.
    const resultado = await sincronizarDonaciones({ filas: [filaDonacion()] });

    expect(resultado.eliminados).toEqual(["alimentos-frijol"]);
    expect(db.peek("catalogoDonaciones/alimentos-frijol")).toBeUndefined();
    expect(db.peek("necesidades/cruz-roja_alimentos-frijol")).toBeUndefined();
    // The item still in the sheet is untouched.
    expect(db.peek("catalogoDonaciones/alimentos-arroz-blanco")).toMatchObject({
      nombre: "Arroz blanco",
    });
  });

  it("writes the catalogue item even when no centre's cell could be applied", async () => {
    const resultado = await sincronizarDonaciones({
      filas: [filaDonacion({ estados: { "Cruz Roja": null } })],
    });

    expect(resultado.elementos).toBe(1);
    expect(resultado.necesidades).toBe(0);
    expect(db.peek("catalogoDonaciones/alimentos-arroz-blanco")).toMatchObject({
      nombre: "Arroz blanco",
    });
  });

  it("reads the sheet's own words for each of the three states", async () => {
    await sincronizarDonaciones({
      filas: [
        filaDonacion({
          estados: {
            "Cruz Roja": "Se necesita",
            "CC Unicentro": "No se necesita",
          },
        }),
      ],
    });

    expect(db.peek("necesidades/cruz-roja_alimentos-arroz-blanco")).toMatchObject({
      estado: "SE_NECESITA",
    });
    expect(db.peek("necesidades/cc-unicentro_alimentos-arroz-blanco")).toMatchObject({
      estado: "SUFICIENTE",
    });
  });

  it("maps the grey state to NO_APLICA", async () => {
    await sincronizarDonaciones({
      filas: [filaDonacion({ estados: { "Cruz Roja": "No se recibe" } })],
    });

    expect(db.peek("necesidades/cruz-roja_alimentos-arroz-blanco")).toMatchObject({
      estado: "NO_APLICA",
    });
  });

  it("leaves an untouched pair alone instead of writing over it with a blank cell", async () => {
    await sincronizarDonaciones({ filas: [filaDonacion()] });

    // A second sync with the same item's cell blank for a different point must
    // not create — or clear — anything for a pair nobody typed into.
    await sincronizarDonaciones({
      filas: [filaDonacion({ estados: { "Cruz Roja": null, "CC Unicentro": "Se necesita" } })],
    });

    expect(db.peek("necesidades/cruz-roja_alimentos-arroz-blanco")).toMatchObject({
      estado: "SE_NECESITA",
    });
    expect(db.peek("necesidades/cc-unicentro_alimentos-arroz-blanco")).toMatchObject({
      estado: "SE_NECESITA",
    });
  });

  it("names the cell whose point is not in the catalogue, without failing the rest", async () => {
    const resultado = await sincronizarDonaciones({
      filas: [
        filaDonacion({
          estados: { "Cruz Roja": "Se necesita", "Estadio El Campín": "Se necesita" },
        }),
      ],
    });

    expect(resultado.necesidades).toBe(1);
    expect(resultado.rechazadas).toEqual([
      { fila: 5, motivo: expect.stringContaining("Estadio El Campín") },
    ]);
  });

  it("names the cell whose status is not one of the dropdown's words", async () => {
    const resultado = await sincronizarDonaciones({
      filas: [
        filaDonacion({ estados: { "Cruz Roja": "Tal vez" } }),
        filaDonacion({ fila: 6, elemento: "Frijol" }),
      ],
    });

    expect(resultado.necesidades).toBe(1);
    expect(resultado.rechazadas).toEqual([{ fila: 5, motivo: expect.stringContaining("Tal vez") }]);
  });

  it("rejects an unknown category without failing the rest of the batch", async () => {
    const resultado = await sincronizarDonaciones({
      filas: [filaDonacion({ fila: 6, categoria: "Electrodomésticos" }), filaDonacion({ fila: 7 })],
    });

    expect(resultado.necesidades).toBe(1);
    expect(resultado.rechazadas).toEqual([
      { fila: 6, motivo: expect.stringContaining("Electrodomésticos") },
    ]);
  });

  it("refuses a batch in which no row could be read at all", async () => {
    await expect(
      sincronizarDonaciones({ filas: [filaDonacion({ categoria: "Electrodomésticos" })] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("converges on the same document however many times the same cell is resent", async () => {
    await sincronizarDonaciones({ filas: [filaDonacion()] });
    await sincronizarDonaciones({ filas: [filaDonacion()] });

    expect(db.pathsIn("necesidades")).toHaveLength(1);
  });
});
