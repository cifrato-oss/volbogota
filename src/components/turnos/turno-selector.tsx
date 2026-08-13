"use client";

import { useMemo, useState } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { JORNADA_LABEL, JORNADA_ORDER } from "@/constants/jornadas";
import { formatFecha } from "@/lib/format-fecha";
import { formatNumero } from "@/lib/format-numero";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import useTurnos from "@/queries/turnos/useTurnos";
import type { Turno } from "@/types/volbogota";

type TurnoSelectorProps = {
  centroId: string;
  selectedTurnoId: string | null;
  onSelect: (turno: Turno) => void;
};

/** Picks a shift for a center: choose a date, then an available jornada. */
export function TurnoSelector({ centroId, selectedTurnoId, onSelect }: TurnoSelectorProps) {
  const { data: turnos, isPending, isError, error, refetch } = useTurnos({ centro: centroId });
  const [fecha, setFecha] = useState<string | null>(null);

  const fechas = useMemo(
    () => (turnos ? [...new Set(turnos.map((turno) => turno.fecha))].sort() : []),
    [turnos],
  );
  const activeFecha = fecha ?? fechas[0] ?? null;

  const jornadas = useMemo(() => {
    if (!turnos || !activeFecha) return [];
    return JORNADA_ORDER.map((jornada) =>
      turnos.find((turno) => turno.fecha === activeFecha && turno.jornada === jornada),
    ).filter((turno): turno is Turno => turno !== undefined);
  }, [turnos, activeFecha]);

  if (isError) {
    return <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />;
  }

  if (isPending) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-11 w-24" />
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (fechas.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed px-6 py-8 text-center text-sm">
        Este centro no tiene turnos disponibles.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">Elige el día</p>
        <div className="flex flex-wrap gap-2">
          {fechas.map((option) => {
            const active = option === activeFecha;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setFecha(option)}
                aria-pressed={active}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm transition-colors first-letter:uppercase",
                  active
                    ? "border-primary ring-primary/40 ring-2"
                    : "border-border hover:border-foreground/25",
                )}
              >
                {formatFecha(option)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Elige la jornada</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {jornadas.map((turno) => {
            const disabled = turno.agotado || turno.estado !== "ABIERTO";
            const selected = turno.id === selectedTurnoId;
            const estadoLabel =
              turno.estado !== "ABIERTO"
                ? "Cerrado"
                : turno.agotado
                  ? "Sin cupos"
                  : `${formatNumero(turno.disponibles)} cupos disponibles`;

            return (
              <button
                key={turno.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(turno)}
                aria-pressed={selected}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  selected
                    ? "border-primary ring-primary/40 ring-2"
                    : "border-border hover:border-foreground/25",
                  disabled && "hover:border-border cursor-not-allowed opacity-50",
                )}
              >
                <div className="font-medium">{JORNADA_LABEL[turno.jornada]}</div>
                <div className="text-muted-foreground text-xs">{turno.horario.etiqueta}</div>
                <div
                  className={cn(
                    "mt-1 text-xs",
                    disabled ? "text-muted-foreground" : "text-foreground/80",
                  )}
                >
                  {estadoLabel}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
