import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { Centro } from "@/types/volbogota";

type CentroHeaderProps = {
  centro: Centro;
  backHref: string;
  backLabel: string;
};

/** Blue header card for a center's detail page: name, location, hours, map. */
export function CentroHeader({ centro, backHref, backLabel }: CentroHeaderProps) {
  const ubicacion = [centro.localidad, centro.direccion].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      <Link
        href={backHref}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {backLabel}
      </Link>

      <div className="rounded-2xl bg-blue-800 p-6 text-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <h1 className="font-heading flex items-center gap-2 text-2xl font-bold tracking-tight">
              <span aria-hidden>🏢</span>
              <span className="min-w-0 break-words">{centro.nombre}</span>
            </h1>
            {ubicacion ? (
              <p className="flex items-center gap-1.5 text-sm text-blue-100">
                <span aria-hidden>📍</span>
                <span>{ubicacion}</span>
              </p>
            ) : null}
            {centro.horarioOficial ? (
              <p className="flex items-center gap-1.5 text-sm text-blue-100">
                <span aria-hidden>🕒</span>
                <span>{centro.horarioOficial}</span>
              </p>
            ) : null}
          </div>

          {centro.linkMaps ? (
            <a
              href={centro.linkMaps}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Ver en Google Maps"
              className="shrink-0 rounded-full bg-white/15 p-3 text-xl transition-colors hover:bg-white/25"
            >
              <span aria-hidden>🗺️</span>
            </a>
          ) : null}
        </div>
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
    </div>
  );
}
