"use client";

import { type CSSProperties, useMemo } from "react";

import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { resolverEstiloJornada } from "@/constants/jornadas";
import { formatFecha } from "@/lib/format-fecha";
import { formatNumero } from "@/lib/format-numero";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";
import type { Turno } from "@/types/volbogota";

type TurnoSelectorProps = {
  turnos: Turno[];
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  selectedTurnoId: string | null;
  onSelect: (turno: Turno) => void;
};

type Columna = {
  jornada: string;
  turnos: Turno[];
  /** No shift bookable — all full or all closed. Collapse it and push it last. */
  sinDisponibles: boolean;
  /** All shifts closed (vs merely full) — decides the collapse message. */
  todosCerrados: boolean;
};

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Shift picker for volunteers. One card per jornada present in Firestore — there
 * can be more than AM/PM (e.g. "TARDE 1") — laid out in a two-column grid,
 * ordered by start time. A jornada with no bookable shifts (all full or all
 * closed) drops to the end and collapses to a single message.
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
  const columnas = useMemo<Columna[]>(() => {
    const grupos = new Map<string, Turno[]>();
    for (const turno of turnos) {
      const lista = grupos.get(turno.jornada) ?? [];
      lista.push(turno);
      grupos.set(turno.jornada, lista);
    }

    return (
      [...grupos.entries()]
        .map(([jornada, lista]) => {
          lista.sort(
            (a, b) =>
              a.fecha.localeCompare(b.fecha) || a.horario.inicio.localeCompare(b.horario.inicio),
          );
          // Sort key by earliest start; a missing inicio sorts last, not first.
          const minInicio = lista.reduce((min, turno) => {
            const inicio = turno.horario.inicio || "99:99";
            return inicio < min ? inicio : min;
          }, "99:99");
          return {
            jornada,
            turnos: lista,
            sinDisponibles: lista.every((turno) => turno.agotado || turno.estado !== "ABIERTO"),
            todosCerrados: lista.every((turno) => turno.estado !== "ABIERTO"),
            minInicio,
          };
        })
        // Bookable jornadas first (earliest start first); unavailable ones last.
        .sort(
          (a, b) =>
            Number(a.sinDisponibles) - Number(b.sinDisponibles) ||
            a.minInicio.localeCompare(b.minInicio) ||
            a.jornada.localeCompare(b.jornada, "es"),
        )
    );
  }, [turnos]);

  if (isError) {
    return <ErrorState message={getErrorMessage(error)} onRetry={onRetry} />;
  }

  if (isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (columnas.length === 0) {
    return (
      <p className="text-muted-foreground rounded-xl border border-dashed px-6 py-8 text-center text-sm">
        Este centro no tiene turnos disponibles.
      </p>
    );
  }

  return (
    <div className="grid items-start gap-4 sm:grid-cols-2">
      {columnas.map((columna, indice) => {
        const estilo = resolverEstiloJornada(columna.jornada, indice);
        return (
          <div
            key={columna.jornada}
            className={cn("bg-card rounded-2xl border border-t-4 p-4", estilo.topBorder)}
          >
            <div className="text-center text-lg font-semibold tracking-tight">
              <span aria-hidden>{estilo.emoji}</span>{" "}
              {columna.jornada ? `Jornada ${columna.jornada}` : "Sin jornada"}
            </div>

            {columna.sinDisponibles ? (
              <p className="text-muted-foreground mt-3 rounded-lg border border-dashed px-4 py-6 text-center text-sm">
                {columna.todosCerrados
                  ? "Todos los turnos están cerrados."
                  : "No hay cupos disponibles."}
              </p>
            ) : (
              <div
                className="scroll-turnos mt-3 max-h-96 space-y-2 overflow-y-auto overscroll-contain pr-1 pl-0.5"
                style={{ "--scroll-thumb": estilo.scrollThumb } as CSSProperties}
              >
                {columna.turnos.map((turno) => {
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
                          ? cn("ring-2", estilo.ring, estilo.selectedRow)
                          : "border-border hover:border-foreground/25",
                        disabled && "hover:border-border cursor-not-allowed opacity-50",
                      )}
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5 font-medium">
                          <span aria-hidden>📅</span>
                          {capitalizar(formatFecha(turno.fecha))}
                        </span>
                        <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                          <span aria-hidden>🕐</span>
                          {turno.horario.etiqueta}
                        </span>
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
            )}
          </div>
        );
      })}
    </div>
  );
}
