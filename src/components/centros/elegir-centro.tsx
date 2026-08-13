"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CentroOption } from "@/components/centros/centro-option";
import { CentroOptionSkeleton } from "@/components/centros/centro-option-skeleton";
import { CentroSelectionBar } from "@/components/centros/centro-selection-bar";
import { ErrorState } from "@/components/shared/error-state";
import { getErrorMessage } from "@/lib/get-error-message";
import useCentros from "@/queries/centros/useCentros";

const SKELETON_COUNT = 6;

/**
 * Landing screen: the volunteer picks a collection center. Mobile-first — a
 * single-column, tappable list (grid on larger screens) with a fixed
 * "Continuar" bar that opens the chosen center's detail + booking page.
 */
export function ElegirCentro() {
  const router = useRouter();
  const { data: centros, isPending, isError, error, refetch } = useCentros();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedCentro = centros?.find((centro) => centro.id === selectedId) ?? null;

  function handleContinue() {
    if (selectedCentro) {
      router.push(`/centros/${selectedCentro.id}`);
    }
  }

  return (
    <div className="space-y-8 pb-24">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Voluntariados Bogotá</h1>
        <p className="text-muted-foreground max-w-2xl text-pretty">
          Súmate como voluntario en los centros de acopio de la ciudad. Elige un centro para ver sus
          jornadas e inscribirte en pocos pasos.
        </p>
      </header>

      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Elige un centro</h2>
          <p className="text-muted-foreground text-sm">
            Selecciona el centro de acopio donde quieres ayudar.
          </p>
        </div>

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
      </div>

      {selectedCentro ? (
        <CentroSelectionBar centro={selectedCentro} onContinue={handleContinue} />
      ) : null}
    </div>
  );
}
