"use client";

import { CentroOption } from "@/components/centros/centro-option";
import { CentroOptionSkeleton } from "@/components/centros/centro-option-skeleton";
import { BackButton } from "@/components/shared/back-button";
import { ErrorState } from "@/components/shared/error-state";
import { getErrorMessage } from "@/lib/get-error-message";
import useCentrosRealtime from "@/queries/centros/useCentrosRealtime";

const SKELETON_COUNT = 6;

type ElegirCentroProps = {
  titulo: string;
  descripcion: string;
  /** Base path a chosen center opens, e.g. "/centros" or "/donar". */
  hrefBase: string;
  /** Show cupos per shift on each card — true for volunteering, false for donating. */
  mostrarCupos?: boolean;
};

/**
 * Reusable center picker. Mobile-first grid of tappable cards; tapping a center
 * navigates straight to its page under `hrefBase`. Shared by the volunteer and
 * donation flows.
 */
export function ElegirCentro({
  titulo,
  descripcion,
  hrefBase,
  mostrarCupos = true,
}: ElegirCentroProps) {
  const { data: centros, isPending, isError, error, refetch } = useCentrosRealtime();

  return (
    <div className="space-y-6">
      <div>
        <BackButton href="/">Volver al inicio</BackButton>
      </div>

      <header className="space-y-1 text-center">
        <h1 className="font-heading text-2xl font-bold tracking-tight">{titulo}</h1>
        <p className="text-muted-foreground text-sm text-pretty">{descripcion}</p>
      </header>

      {isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {isPending
            ? Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <CentroOptionSkeleton key={index} />
              ))
            : centros.map((centro) => (
                <CentroOption
                  key={centro.id}
                  centro={centro}
                  href={`${hrefBase}/${centro.id}`}
                  mostrarCupos={mostrarCupos}
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
  );
}
