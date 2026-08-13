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

type ElegirCentroProps = {
  titulo: string;
  descripcion: string;
  /** Base path the chosen center opens, e.g. "/centros" or "/donar". */
  hrefBase: string;
  ctaLabel?: string;
};

/**
 * Reusable center picker. Mobile-first single-column list (grid on larger
 * screens) with a fixed action bar that opens the chosen center under
 * `hrefBase`. Shared by the volunteer and donation flows.
 */
export function ElegirCentro({ titulo, descripcion, hrefBase, ctaLabel }: ElegirCentroProps) {
  const router = useRouter();
  const { data: centros, isPending, isError, error, refetch } = useCentros();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedCentro = centros?.find((centro) => centro.id === selectedId) ?? null;

  function handleContinue() {
    if (selectedCentro) {
      router.push(`${hrefBase}/${selectedCentro.id}`);
    }
  }

  return (
    <div className="space-y-6 pb-24">
      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">{titulo}</h1>
        <p className="text-muted-foreground text-sm">{descripcion}</p>
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
        <CentroSelectionBar
          centro={selectedCentro}
          onContinue={handleContinue}
          ctaLabel={ctaLabel}
        />
      ) : null}
    </div>
  );
}
