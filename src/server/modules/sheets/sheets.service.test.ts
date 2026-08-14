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
  },
  getDb: () => db,
}));

const { sincronizarCentrosDesdeSheet, sincronizarReservasDesdeSheet, sincronizarTurnosDesdeSheet } =
  await import("./sheets.service");
const { sincronizarCentrosSchema, sincronizarReservasSchema, sincronizarTurnosSchema } =
  await import("./sheets.schema");

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

/** A row of the `Turnos` board, as Apps Script reads it. */
function filaTurno(overrides: Record<string, unknown> = {}) {
  return {
    fila: 2,
    puntoDeAcopio: "Punto Usaquén",
    fecha: "13/08/2026",
    jornada: "AM",
    horario: null,
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
  it("writes the point and its shifts for every date", async () => {
    const resultado = await sincronizarCentros({
      filas: [filaCentro()],
      fechas: FECHAS,
    });

    expect(resultado.centros).toBe(1);
    expect(resultado.turnos).toBe(6); // 1 punto × 2 fechas × 3 jornadas

    expect(db.peek("centros/punto-usaquen")).toMatchObject({
      nombre: "Punto Usaquén",
      localidad: "Usaquén",
      // No evening column in the row: the point simply does not open at night.
      cuposPorJornada: { AM: 150, PM: 150, NOCHE: 0 },
      activo: true,
    });

    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({
      cuposTotales: 150,
      reservados: 0,
      estado: "ABIERTO",
      diaSemana: "Jueves",
    });
  });

  it("opens the evening shift when the sheet fills 'Cupos Noche'", async () => {
    await sincronizarCentros({
      filas: [filaCentro({ cuposNoche: "150" })],
      fechas: FECHAS,
    });

    expect(db.peek("turnos/punto-usaquen_2026-08-13_noche")).toMatchObject({
      cuposTotales: 150,
      estado: "ABIERTO",
      horario: { etiqueta: "7:00 p.m. - 10:00 p.m." },
    });
  });

  it("closes the shift when the sheet sets that slot's capacity to zero", async () => {
    // This is how the file says "this point does not open in that shift".
    await sincronizarCentros({
      filas: [filaCentro({ puntoDeAcopio: "CC Unicentro", cuposPm: "0" })],
      fechas: FECHAS,
    });

    expect(db.peek("turnos/cc-unicentro_2026-08-13_pm")).toMatchObject({
      cuposTotales: 0,
      estado: "CERRADO",
    });
  });

  it("never wipes bookings already taken when capacity is edited", async () => {
    await sincronizarCentros({ filas: [filaCentro()], fechas: FECHAS });

    db.seed("turnos/punto-usaquen_2026-08-13_am", {
      ...db.peek("turnos/punto-usaquen_2026-08-13_am"),
      reservados: 40,
    });

    await sincronizarCentros({
      filas: [filaCentro({ cuposAm: "200" })],
      fechas: FECHAS,
    });

    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({
      cuposTotales: 200,
      reservados: 40,
    });
  });

  it("applies a capacity cut below what is booked, leaving it visibly oversold", async () => {
    // The sheet is the authority on capacity. Refusing the edit would hide a
    // real decision; dropping volunteers to fit would be worse.
    await sincronizarCentros({ filas: [filaCentro()], fechas: FECHAS });
    db.seed("turnos/punto-usaquen_2026-08-13_am", {
      ...db.peek("turnos/punto-usaquen_2026-08-13_am"),
      reservados: 100,
    });

    await sincronizarCentros({
      filas: [filaCentro({ cuposAm: "10" })],
      fechas: FECHAS,
    });

    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({
      cuposTotales: 10,
      reservados: 100,
    });
  });

  it("skips the totals row and the footnotes under the table", async () => {
    const resultado = await sincronizarCentros({
      filas: [
        filaCentro(),
        filaCentro({ puntoDeAcopio: "TOTAL", cuposAm: "1,050" }),
        filaCentro({ puntoDeAcopio: "SUPUESTO: los cupos por jornada los puse yo" }),
        filaCentro({ puntoDeAcopio: "Un cupo en 0 desactiva ese turno" }),
      ],
      fechas: FECHAS,
    });

    expect(resultado.centros).toBe(1);
    expect(db.peek("centros/total")).toBeUndefined();
  });

  it("drops activities that are not in the closed set instead of failing", async () => {
    await sincronizarCentros({
      filas: [filaCentro({ actividades: "Empaque, Logística, Clasificación" })],
      fechas: FECHAS,
    });

    expect(db.peek("centros/punto-usaquen")?.actividades).toEqual(["Empaque", "Clasificación"]);
  });

  it("retires a point that disappeared from the sheet without deleting it", async () => {
    await sincronizarCentros({
      filas: [filaCentro(), filaCentro({ puntoDeAcopio: "Cruz Roja" })],
      fechas: FECHAS,
    });

    const resultado = await sincronizarCentros({
      filas: [filaCentro()],
      fechas: FECHAS,
    });

    expect(resultado.desactivados).toEqual(["cruz-roja"]);
    // Kept, not deleted: reservations still point at its shifts.
    expect(db.peek("centros/cruz-roja")).toMatchObject({ activo: false });
    expect(db.peek("turnos/cruz-roja_2026-08-13_am")).toMatchObject({
      centroActivo: false,
      estado: "CERRADO",
    });
  });

  it("accepts a row that omits the optional columns entirely", async () => {
    // The totals row and any short row send fewer keys, not keys set to null.
    // Requiring every column would reject the batch on a row we then discard.
    const resultado = await sincronizarCentros({
      filas: [
        { puntoDeAcopio: "Cruz Roja", cuposAm: "150", cuposPm: "150" },
        { puntoDeAcopio: "TOTAL", cuposAm: "1,050" },
      ],
      fechas: FECHAS,
    });

    expect(resultado.centros).toBe(1);
    expect(db.peek("centros/cruz-roja")).toMatchObject({
      direccion: null,
      observaciones: null,
      activo: true,
    });
  });

  it("refuses a batch with no actual points", async () => {
    await expect(
      sincronizarCentros({
        filas: [filaCentro({ puntoDeAcopio: "TOTAL" })],
        fechas: FECHAS,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("reuses the dates already loaded when the batch does not restate them", async () => {
    await sincronizarCentros({ filas: [filaCentro()], fechas: FECHAS });

    const resultado = await sincronizarCentros({ filas: [filaCentro({ cuposAm: "80" })] });

    expect(resultado.fechas).toEqual(FECHAS);
    expect(db.peek("turnos/punto-usaquen_2026-08-14_am")).toMatchObject({ cuposTotales: 80 });
  });
});

describe("sincronizarTurnosDesdeSheet", () => {
  beforeEach(async () => {
    await sincronizarCentros({ filas: [filaCentro()], fechas: FECHAS });
  });

  it("lets the board authorise more capacity than the point's nominal figure", async () => {
    // This is the whole point of the board: 300 on Thursday at a point whose
    // `Centros` row says 150, without touching the other days.
    const resultado = await sincronizarTurnos({ filas: [filaTurno({ cuposTotales: "300" })] });

    expect(resultado.rechazadas).toEqual([]);
    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ cuposTotales: 300 });
    expect(db.peek("turnos/punto-usaquen_2026-08-14_am")).toMatchObject({ cuposTotales: 150 });
  });

  it("reverts a shift to the nominal capacity when its row is deleted", async () => {
    await sincronizarTurnos({ filas: [filaTurno({ cuposTotales: "300" })] });

    // The row is gone from the board; another row keeps the batch non-empty.
    await sincronizarTurnos({ filas: [filaTurno({ jornada: "PM", cuposTotales: "150" })] });

    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ cuposTotales: 150 });
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
        filaTurno({ fila: 4, jornada: "Madrugada" }),
        filaTurno({ fila: 5, jornada: "PM", horario: "por la mañana" }),
      ],
    });

    expect(resultado.rechazadas.map((r) => r.fila)).toEqual([3, 4, 5]);
    expect(resultado.rechazadas[0]?.motivo).toMatch(/no entiendo la fecha/i);
    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ cuposTotales: 300 });
  });

  it("names the row whose point is not in the catalogue", async () => {
    const resultado = await sincronizarTurnos({
      filas: [filaTurno({ fila: 7, puntoDeAcopio: "Estadio El Campin" })],
    });

    expect(resultado.rechazadas).toEqual([
      { fila: 7, motivo: expect.stringContaining("estadio-el-campin") },
    ]);
  });

  it("refuses a batch in which no row could be read", async () => {
    await expect(
      sincronizarTurnos({ filas: [filaTurno({ jornada: "Madrugada" })] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("survives an edit to Centros when the board travels with it", async () => {
    // The board is what authorises 300 for one day. Rebuilding the shifts from
    // the centres alone would quietly undo it on the next address correction.
    const tablero = [filaTurno({ cuposTotales: "300" })];

    await sincronizarTurnos({ filas: tablero });
    await sincronizarCentros({
      filas: [filaCentro({ localidad: "Usaquén (corregido)" })],
      fechas: FECHAS,
      turnos: tablero,
    });

    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ cuposTotales: 300 });
  });

  it("reads a formula row and a hard-typed row from the same column", async () => {
    // The sheet sends computed values, so `Cupos totales` carries the figure
    // looked up in `Centros` and the one typed over it without distinction.
    await sincronizarCentros({
      filas: [filaCentro()],
      fechas: FECHAS,
      turnos: [
        filaTurno({ fila: 2, cuposTotales: "150" }), // = INDEX(Centros!…)
        filaTurno({ fila: 3, fecha: "14/08/2026", cuposTotales: "400" }), // typed over
      ],
    });

    expect(db.peek("turnos/punto-usaquen_2026-08-13_am")).toMatchObject({ cuposTotales: 150 });
    expect(db.peek("turnos/punto-usaquen_2026-08-14_am")).toMatchObject({ cuposTotales: 400 });
  });

  it("reports a board row the Centros payload does not contain", async () => {
    const resultado = await sincronizarCentros({
      filas: [filaCentro()],
      fechas: FECHAS,
      turnos: [filaTurno({ fila: 9, puntoDeAcopio: "Estadio El Campin" })],
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
    await sincronizarCentros({ filas: [filaCentro()], fechas: FECHAS });
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
