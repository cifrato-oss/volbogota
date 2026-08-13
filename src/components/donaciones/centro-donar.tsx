"use client";

import { CentroHeader } from "@/components/centros/centro-header";
import { CentroMapa } from "@/components/centros/centro-mapa";
import { NecesidadesList } from "@/components/donaciones/necesidades-list";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/get-error-message";
import useCentro from "@/queries/centros/useCentro";

/** Donation view for a center: its info, needs list, and location. */
export function CentroDonar({ centroId }: { centroId: string }) {
  const { data: centro, isPending, isError, error, refetch } = useCentro(centroId);

  if (isError) {
    return (
      <div className="space-y-6 pb-16">
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="space-y-4 pb-16">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      <CentroHeader centro={centro} backHref="/donar" backLabel="Volver a centros" />
      <NecesidadesList key={centro.id} centroId={centro.id} />
      <CentroMapa centro={centro} />
    </div>
  );
}
