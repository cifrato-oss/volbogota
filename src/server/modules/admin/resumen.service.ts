import { COLLECTIONS, getDb } from "@/server/db/firestore";
import { listarCentros, listarTurnos } from "@/server/modules/catalogo/catalogo.service";
import { ESTADOS_RESERVA, type EstadoReserva } from "@/server/modules/reservas/reservas.schema";

/**
 * The `Resumen` sheet of the spreadsheet, computed live.
 *
 * Capacity comes from the shift counters, which the booking transaction owns.
 * Attendance comes from the reservations themselves, because nothing keeps a
 * running total of it — and unlike capacity, it does not need to be exact under
 * concurrency, so a scan is fine.
 */

export type ResumenOperativo = {
  cupos: { ofertados: number; reservados: number; disponibles: number; ocupacion: number };
  reservas: { total: number; porEstado: Record<EstadoReserva, number> };
  asistencia: {
    asistieron: number;
    noAsistieron: number;
    porcentaje: number;
    horasDonadas: number;
  };
  porCentro: Array<{
    id: string;
    nombre: string;
    cupos: number;
    reservados: number;
    disponibles: number;
    ocupacion: number;
    asistieron: number;
  }>;
  porDia: Array<{
    fecha: string;
    cupos: number;
    reservados: number;
    ocupacion: number;
    porJornada: Record<string, number>;
  }>;
  generadoEn: string;
};

export async function obtenerResumen(): Promise<ResumenOperativo> {
  const [centros, turnos, reservasSnap] = await Promise.all([
    listarCentros(),
    listarTurnos(),
    getDb().collection(COLLECTIONS.reservas).get(),
  ]);

  const reservas = reservasSnap.docs.map((doc) => doc.data());

  const porEstado = Object.fromEntries(ESTADOS_RESERVA.map((estado) => [estado, 0])) as Record<
    EstadoReserva,
    number
  >;
  let horasDonadas = 0;

  for (const reserva of reservas) {
    const estado = String(reserva.estado) as EstadoReserva;
    if (estado in porEstado) porEstado[estado] += 1;
    horasDonadas += Number(reserva.horas) || 0;
  }

  const ofertados = turnos.reduce((total, turno) => total + turno.cuposTotales, 0);
  const reservados = turnos.reduce((total, turno) => total + turno.reservados, 0);

  const evaluados = porEstado.ASISTIO + porEstado.NO_ASISTIO;

  const porCentro = centros.map((centro) => {
    const suyos = turnos.filter((turno) => turno.centroId === centro.id);
    const cupos = suyos.reduce((total, turno) => total + turno.cuposTotales, 0);
    const ocupados = suyos.reduce((total, turno) => total + turno.reservados, 0);

    return {
      id: centro.id,
      nombre: centro.nombre,
      cupos,
      reservados: ocupados,
      disponibles: Math.max(0, cupos - ocupados),
      ocupacion: cupos === 0 ? 0 : ocupados / cupos,
      asistieron: reservas.filter((r) => r.centroId === centro.id && r.estado === "ASISTIO").length,
    };
  });

  const fechas = [...new Set(turnos.map((turno) => turno.fecha))].sort();

  const porDia = fechas.map((fecha) => {
    const delDia = turnos.filter((turno) => turno.fecha === fecha);
    const cupos = delDia.reduce((total, turno) => total + turno.cuposTotales, 0);
    const ocupados = delDia.reduce((total, turno) => total + turno.reservados, 0);

    return {
      fecha,
      cupos,
      reservados: ocupados,
      ocupacion: cupos === 0 ? 0 : ocupados / cupos,
      porJornada: Object.fromEntries(
        delDia.map((turno) => [turno.jornada, turno.reservados]),
      ) as Record<string, number>,
    };
  });

  return {
    cupos: {
      ofertados,
      reservados,
      disponibles: Math.max(0, ofertados - reservados),
      ocupacion: ofertados === 0 ? 0 : reservados / ofertados,
    },
    reservas: { total: reservas.length, porEstado },
    asistencia: {
      asistieron: porEstado.ASISTIO,
      noAsistieron: porEstado.NO_ASISTIO,
      porcentaje: evaluados === 0 ? 0 : porEstado.ASISTIO / evaluados,
      horasDonadas: Math.round(horasDonadas * 100) / 100,
    },
    porCentro,
    porDia,
    generadoEn: new Date().toISOString(),
  };
}
