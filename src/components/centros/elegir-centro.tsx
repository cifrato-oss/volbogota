"use client";

import { useState } from "react";

import { CentroOption } from "@/components/centros/centro-option";
import { CentroOptionSkeleton } from "@/components/centros/centro-option-skeleton";
import { CentroSelectionBar } from "@/components/centros/centro-selection-bar";
import { ErrorState } from "@/components/shared/error-state";
import { getErrorMessage } from "@/lib/get-error-message";
import useCentros from "@/queries/centros/useCentros";

const SKELETON_COUNT = 6;

/**
 * First screen: the volunteer picks a collection center. Mobile-first — a
 * single-column, tappable list with a fixed "Continuar" bar once one is chosen.
 */
export function ElegirCentro() {
  const { data: centros, isPending, isError, error, refetch } = useCentros();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedCentro = centros?.find((centro) => centro.id === selectedId) ?? null;

  function handleContinue() {
    // TODO: siguiente paso — elegir jornada y turno del centro seleccionado.
  }

  return (
    <div className="space-y-5 pb-24">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Elige un centro</h1>
        <p className="text-muted-foreground text-sm">
          Selecciona el centro de acopio donde quieres ser voluntario.
        </p>
      </header>

      {isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isPending
            ? Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <CentroOptionSkeleton key={index} />
              ))
            : centros.map((centro) => (
                <CentroOption
                  key={centro.id}
                  centro={centro}
                  selected={centro.id === selectedId}
                  onSelect={setSelectedId}
                />
              ))}
        </div>
      )}

      {!isPending && !isError && centros.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed px-6 py-10 text-center text-sm">
          Aún no hay centros disponibles.
        </p>
      ) : null}

      {selectedCentro ? (
        <CentroSelectionBar centro={selectedCentro} onContinue={handleContinue} />
      ) : null}
    </div>
  );
}
