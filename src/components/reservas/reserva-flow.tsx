"use client";

import { useState } from "react";

import { ReservaConfirmacion } from "@/components/reservas/reserva-confirmacion";
import { ReservaForm } from "@/components/reservas/reserva-form";
import { TurnoSelector } from "@/components/turnos/turno-selector";
import { formatFecha } from "@/lib/format-fecha";
import { formatNumero } from "@/lib/format-numero";
import { cn } from "@/lib/utils";
import useTurnosRealtime from "@/queries/turnos/useTurnosRealtime";
import type { Reserva, Turno } from "@/types/volbogota";

/** Info banner under the grid recapping the shift the volunteer picked. */
function TurnoSeleccionadoBanner({ turno }: { turno: Turno }) {
  const disponible = turno.estado === "ABIERTO" && !turno.agotado;
  const fecha = formatFecha(turno.fecha);

  return (
    <div
      className="border-primary/20 bg-primary/5 rounded-xl border p-4"
      role="status"
      aria-live="polite"
    >
      <p className="text-primary text-xs font-semibold tracking-wide uppercase">
        Turno seleccionado
      </p>
      <div className="text-foreground mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5 font-medium">
          <span aria-hidden>📅</span>
          {fecha.charAt(0).toUpperCase() + fecha.slice(1)}
        </span>
        <span className="text-muted-foreground flex items-center gap-1.5">
          <span aria-hidden>🕐</span>
          Jornada {turno.jornada} · {turno.horario.etiqueta}
        </span>
        <span className="text-muted-foreground flex items-center gap-1.5">
          <span aria-hidden>📍</span>
          {turno.centroNombre}
        </span>
        <span
          className={cn(
            "ml-auto shrink-0 font-medium",
            disponible ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
          )}
        >
          {disponible
            ? `${formatNumero(turno.disponibles)} cupos disponibles`
            : turno.agotado
              ? "Sin cupos"
              : "Cerrado"}
        </span>
      </div>
    </div>
  );
}

/**
 * Two-step booking flow for a center: pick a shift, then fill in the form.
 * Replaces itself with a confirmation once the reserva succeeds.
 *
 * The live shifts are subscribed here (not in the selector) so the picked shift
 * tracks Firestore: if its cupos drop to 0 while the volunteer is filling the
 * form, the "Reservar cupo" button switches off on its own.
 */
export function ReservaFlow({ centroId }: { centroId: string }) {
  const [selectedTurnoId, setSelectedTurnoId] = useState<string | null>(null);
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const { data: turnos, isPending, isError, error, refetch } = useTurnosRealtime(centroId);

  if (reserva) {
    return <ReservaConfirmacion reserva={reserva} />;
  }

  // Live view of the picked shift; `null` once it's gone, full, or closed.
  const seleccionado = turnos.find((turno) => turno.id === selectedTurnoId) ?? null;
  const reservable =
    seleccionado && !seleccionado.agotado && seleccionado.estado === "ABIERTO"
      ? seleccionado
      : null;

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="paso-turno">
        <h2 id="paso-turno" className="text-lg font-semibold tracking-tight">
          1. Elige tu turno
        </h2>
        <TurnoSelector
          turnos={turnos}
          isPending={isPending}
          isError={isError}
          error={error}
          onRetry={refetch}
          selectedTurnoId={selectedTurnoId}
          onSelect={(turno) => setSelectedTurnoId(turno.id)}
        />
        {seleccionado ? <TurnoSeleccionadoBanner turno={seleccionado} /> : null}
      </section>

      <section className="space-y-3" aria-labelledby="paso-datos">
        <h2 id="paso-datos" className="text-lg font-semibold tracking-tight">
          2. Tus datos
        </h2>
        <ReservaForm
          turno={reservable}
          turnoLleno={seleccionado !== null && reservable === null}
          onSuccess={setReserva}
        />
      </section>
    </div>
  );
}
