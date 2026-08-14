import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/shared/back-button";
import type { Centro } from "@/types/volbogota";

type CentroHeaderProps = {
  centro: Centro;
  backHref: string;
  backLabel: string;
  /** The coordinator notes are volunteer-oriented, so the donation view hides them. */
  mostrarObservaciones?: boolean;
};

/** A titled block so each piece of center info reads clearly as what it is. */
function SeccionInfo({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="space-y-0.5">
        <h2 className="text-sm font-semibold tracking-tight">{titulo}</h2>
        <p className="text-muted-foreground text-xs">{descripcion}</p>
      </div>
      {children}
    </section>
  );
}

/** Header card for a center's detail page: name, location, hours, map. */
export function CentroHeader({
  centro,
  backHref,
  backLabel,
  mostrarObservaciones = true,
}: CentroHeaderProps) {
  const ubicacion = [centro.localidad, centro.direccion].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      <BackButton href={backHref}>{backLabel}</BackButton>

      <div className="border-primary/15 bg-primary/5 rounded-2xl border p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <h1 className="font-heading flex items-center gap-2 text-2xl font-bold tracking-tight">
              <span aria-hidden>🏢</span>
              <span className="min-w-0 break-words">{centro.nombre}</span>
            </h1>
            {ubicacion ? (
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <span aria-hidden>📍</span>
                <span>{ubicacion}</span>
              </p>
            ) : null}
            {centro.horarioOficial ? (
              <p className="ring-primary/20 bg-primary/10 text-primary mt-1 flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset">
                <span aria-hidden>🕒</span>
                <span>
                  <span className="font-normal opacity-80">Horario:</span> {centro.horarioOficial}
                </span>
              </p>
            ) : null}
          </div>

          {centro.linkMaps ? (
            <a
              href={centro.linkMaps}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ver en Google Maps"
              className="bg-primary/10 text-primary hover:bg-primary/20 shrink-0 rounded-full p-3 text-xl transition-colors"
            >
              <span aria-hidden>🗺️</span>
            </a>
          ) : null}
        </div>
      </div>

      {centro.actividades.length > 0 ? (
        <SeccionInfo
          titulo="Actividades"
          descripcion="Tareas que se realizan en este punto de acopio."
        >
          <div className="flex flex-wrap gap-1.5">
            {centro.actividades.map((actividad) => (
              <Badge key={actividad} variant="secondary">
                {actividad}
              </Badge>
            ))}
          </div>
        </SeccionInfo>
      ) : null}

      {mostrarObservaciones && centro.observaciones ? (
        <SeccionInfo
          titulo="Observaciones"
          descripcion="Información importante que debes tener en cuenta sobre este punto."
        >
          <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
            {centro.observaciones}
          </p>
        </SeccionInfo>
      ) : null}
    </div>
  );
}
