"use client";

import { useState } from "react";

import { ReservaConfirmacion } from "@/components/reservas/reserva-confirmacion";
import { ReservaForm } from "@/components/reservas/reserva-form";
import { TurnoSelector } from "@/components/turnos/turno-selector";
import useTurnosRealtime from "@/queries/turnos/useTurnosRealtime";
import type { Reserva } from "@/types/volbogota";

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
