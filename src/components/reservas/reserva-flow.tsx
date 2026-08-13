"use client";

import { useState } from "react";

import { ReservaConfirmacion } from "@/components/reservas/reserva-confirmacion";
import { ReservaForm } from "@/components/reservas/reserva-form";
import { TurnoSelector } from "@/components/turnos/turno-selector";
import type { Reserva, Turno } from "@/types/volbogota";

/**
 * Two-step booking flow for a center: pick a shift, then fill in the form.
 * Replaces itself with a confirmation once the reserva succeeds.
 */
export function ReservaFlow({ centroId }: { centroId: string }) {
  const [turno, setTurno] = useState<Turno | null>(null);
  const [reserva, setReserva] = useState<Reserva | null>(null);

  if (reserva) {
    return <ReservaConfirmacion reserva={reserva} />;
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3" aria-labelledby="paso-turno">
        <h2 id="paso-turno" className="text-lg font-semibold tracking-tight">
          1. Elige tu turno
        </h2>
        <TurnoSelector
          centroId={centroId}
          selectedTurnoId={turno?.id ?? null}
          onSelect={setTurno}
        />
      </section>

      <section className="space-y-3" aria-labelledby="paso-datos">
        <h2 id="paso-datos" className="text-lg font-semibold tracking-tight">
          2. Tus datos
        </h2>
        <ReservaForm turno={turno} onSuccess={setReserva} />
      </section>
    </div>
  );
}
