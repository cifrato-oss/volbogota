"use client";

import { CalendarDays } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Stat } from "@/components/shared/stat";
import { formatNumero } from "@/lib/format-numero";
import { formatRangoFechas } from "@/lib/format-rango-fechas";
import useCatalogos from "@/queries/catalogos/useCatalogos";

/**
 * Landing hero for the volunteer program. Static copy renders immediately;
 * the program dates, activities, and headline metrics come from `/catalogos`.
 */
export function HomeHero() {
  const { data: catalogos, isPending, isError } = useCatalogos();
  const showData = !isError;

  return (
    <section className="space-y-6 py-6">
      <div className="max-w-2xl space-y-4">
        {showData ? (
          <div className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
            <CalendarDays className="size-4" aria-hidden />
            {isPending ? (
              <Skeleton className="h-4 w-56" />
            ) : (
              <span>{formatRangoFechas(catalogos.fechas)}</span>
            )}
          </div>
        ) : null}

        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Sé voluntario en Bogotá
        </h1>
        <p className="text-muted-foreground text-lg text-pretty">
          Únete a los centros de acopio de la ciudad. Elige un centro, una jornada y la actividad en
          la que quieres ayudar.
        </p>

        <div className="flex flex-wrap gap-3 pt-1">
          <Button size="lg" render={<a href="#centros-heading" />}>
            Ver centros
          </Button>
        </div>
      </div>

      {showData ? (
        <div className="border-foreground/10 grid grid-cols-2 gap-6 border-t pt-6 sm:grid-cols-4">
          {isPending ? (
            Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-7 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          ) : (
            <>
              <Stat value={formatNumero(catalogos.centros.length)} label="Centros de acopio" />
              <Stat value={formatNumero(catalogos.fechas.length)} label="Días de jornada" />
              <Stat value={formatNumero(catalogos.jornadas.length)} label="Jornadas por día" />
              <Stat value={formatNumero(catalogos.actividades.length)} label="Tipos de actividad" />
            </>
          )}
        </div>
      ) : null}

      {!isPending && !isError && catalogos.actividades.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-sm">Actividades:</span>
          {catalogos.actividades.map((actividad) => (
            <Badge key={actividad} variant="outline">
              {actividad}
            </Badge>
          ))}
        </div>
      ) : null}
    </section>
  );
}
