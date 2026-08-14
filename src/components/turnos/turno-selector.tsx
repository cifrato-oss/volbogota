"use client";

import { useMemo } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  JORNADA_HORARIO,
  JORNADA_LABEL,
  JORNADA_STYLE,
  JORNADAS_VOLUNTARIADO,
} from "@/constants/jornadas";
import { formatFecha } from "@/lib/format-fecha";
import { formatNumero } from "@/lib/format-numero";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import type { Jornada, Turno } from "@/types/volbogota";

type TurnoSelectorProps = {
  turnos: Turno[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  selectedTurnoId: string | null;
  onSelect: (turno: Turno) => void;
};

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Shift picker for volunteers. Two columns — Mañana and Noche (no afternoon) —
 * each listing every date with live availability. Pick a date to book it.
 */
export function TurnoSelector({
  turnos,
  isPending,
  isError,
  error,
  onRetry,
  selectedTurnoId,
  onSelect,
}: TurnoSelectorProps) {
  const porJornada = useMemo(() => {
    const grouped = new Map<Jornada, Turno[]>(
      JORNADAS_VOLUNTARIADO.map((jornada) => [jornada, []]),
    );
    for (const turno of turnos ?? []) {
      grouped.get(turno.jornada)?.push(turno);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.fecha.localeCompare(b.fecha));
    }
    return grouped;
  }, [turnos]);

  if (isError) {
    return <ErrorState message={getErrorMessage(error)} onRetry={onRetry} />;
  }

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {JORNADAS_VOLUNTARIADO.map((jornada) => (
          <Skeleton key={jornada} className="h-72 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  const hasTurnos = JORNADAS_VOLUNTARIADO.some(
    (jornada) => (porJornada.get(jornada) ?? []).length > 0,
  );
  if (!hasTurnos) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed px-6 py-8 text-center text-sm">
        Este centro no tiene turnos disponibles.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {JORNADAS_VOLUNTARIADO.map((jornada) => {
        const list = porJornada.get(jornada) ?? [];
        if (list.length === 0) return null;

        const style = JORNADA_STYLE[jornada];
        // Show the schedule label straight from Firestore; fall back to the constant.
        const horario = list[0]?.horario.etiqueta ?? JORNADA_HORARIO[jornada] ?? "";

        return (
          <div
            key={jornada}
            className={cn("bg-card rounded-2xl border border-t-4 p-4", style.topBorder)}
          >
            <div className="text-center">
              <div className="text-lg font-semibold tracking-tight">
                <span aria-hidden>{style.emoji}</span> Jornada {JORNADA_LABEL[jornada]}
              </div>
              <div className="text-muted-foreground text-sm">{horario}</div>
            </div>

            <div className="mt-3 space-y-2">
              {list.map((turno) => {
                const disabled = turno.agotado || turno.estado !== "ABIERTO";
                const selected = turno.id === selectedTurnoId;
                const cuposLabel =
                  turno.estado !== "ABIERTO"
                    ? "Cerrado"
                    : turno.agotado
                      ? "Sin cupos"
                      : `${formatNumero(turno.disponibles)} cupos`;

                return (
                  <button
                    key={turno.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(turno)}
                    aria-pressed={selected}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      selected
                        ? cn("ring-2", style.ring, style.selectedRow)
                        : "border-border hover:border-foreground/25",
                      disabled && "hover:border-border cursor-not-allowed opacity-50",
                    )}
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <span aria-hidden>📅</span>
                      {capitalizar(formatFecha(turno.fecha))}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-medium",
                        disabled
                          ? "text-muted-foreground"
                          : "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {cuposLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
