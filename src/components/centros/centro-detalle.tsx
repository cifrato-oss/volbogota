"use client";

import { ArrowLeft, Clock, MapPin } from "lucide-react";
import Link from "next/link";

import { ReservaFlow } from "@/components/reservas/reserva-flow";
import { ErrorState } from "@/components/shared/error-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/get-error-message";
import useCentro from "@/queries/centros/useCentro";

/** Center detail page: shows the center's info and the booking flow. */
export function CentroDetalle({ centroId }: { centroId: string }) {
  const { data: centro, isPending, isError, error, refetch } = useCentro(centroId);

  return (
    <div className="space-y-8 pb-16">
      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver a centros
      </Link>

      {isError ? (
        <ErrorState message={getErrorMessage(error)} onRetry={() => refetch()} />
      ) : isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      ) : (
        <>
          <header className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">{centro.nombre}</h1>

            <div className="text-muted-foreground space-y-1 text-sm">
              {centro.localidad || centro.direccion ? (
                <p className="flex items-center gap-1.5">
                  <MapPin className="size-4 shrink-0" aria-hidden />
                  {[centro.localidad, centro.direccion].filter(Boolean).join(" · ")}
                </p>
              ) : null}
              {centro.horarioOficial ? (
                <p className="flex items-center gap-1.5">
                  <Clock className="size-4 shrink-0" aria-hidden />
                  {centro.horarioOficial}
                </p>
              ) : null}
            </div>

            {centro.actividades.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {centro.actividades.map((actividad) => (
                  <Badge key={actividad} variant="secondary">
                    {actividad}
                  </Badge>
                ))}
              </div>
            ) : null}

            {centro.observaciones ? (
              <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
                {centro.observaciones}
              </p>
            ) : null}
          </header>

          {centro.activo ? (
            <ReservaFlow centroId={centro.id} />
          ) : (
            <p className="text-muted-foreground rounded-xl border border-dashed px-6 py-8 text-center text-sm">
              Este centro no está disponible para inscripciones por ahora.
            </p>
          )}
        </>
      )}
    </div>
  );
}
