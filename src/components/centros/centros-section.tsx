"use client";

import { CentroCard } from "@/components/centros/centro-card";
import { CentroCardSkeleton } from "@/components/centros/centro-card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { SectionHeading } from "@/components/shared/section-heading";
import { getErrorMessage } from "@/lib/get-error-message";
import useCentros from "@/queries/centros/useCentros";

const SKELETON_COUNT = 6;

/** Lists all active donation centers, with loading, error, and empty states. */
export function CentrosSection() {
  const { data: centros, isPending, isError, error, refetch } = useCentros();

  return (
    <section className="space-y-4" aria-labelledby="centros-heading">
      <div id="centros-heading">
        <SectionHeading
          title="Centros de acopio"
          description="Elige un centro para conocer sus actividades y jornadas disponibles."
        />
      </div>

      {isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isPending
            ? Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <CentroCardSkeleton key={index} />
              ))
            : centros.map((centro) => <CentroCard key={centro.id} centro={centro} />)}
        </div>
      )}

      {!isPending && !isError && centros.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed px-6 py-10 text-center text-sm">
          Aún no hay centros disponibles.
        </p>
      ) : null}
    </section>
  );
}
