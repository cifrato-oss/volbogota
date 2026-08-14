"use client";

import { CentroHeader } from "@/components/centros/centro-header";
import { CentroMapa } from "@/components/centros/centro-mapa";
import { ReservaFlow } from "@/components/reservas/reserva-flow";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/get-error-message";
import useCentroRealtime from "@/queries/centros/useCentroRealtime";

/** Center detail page for volunteers: info, booking flow, and location. */
export function CentroDetalle({ centroId }: { centroId: string }) {
  const { data: centro, isPending, isError, error, refetch } = useCentroRealtime(centroId);

  if (isError) {
    return (
      <div className="space-y-6 pb-16">
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      </div>
    );
  }

  if (isPending || !centro) {
    return (
      <div className="space-y-4 pb-16">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      <CentroHeader centro={centro} backHref="/voluntario" backLabel="Volver a centros" />

      {centro.activo ? (
        <ReservaFlow centroId={centro.id} />
      ) : (
        <p className="text-muted-foreground rounded-xl border border-dashed px-6 py-8 text-center text-sm">
          Este centro no está disponible para inscripciones por ahora.
        </p>
      )}

      <CentroMapa centro={centro} />
    </div>
  );
}
