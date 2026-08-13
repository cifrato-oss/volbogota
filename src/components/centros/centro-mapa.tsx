"use client";

import { ExternalLink } from "lucide-react";
import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import useGeocode from "@/queries/geocode/useGeocode";
import type { Centro } from "@/types/volbogota";

const MapaView = dynamic(
  () => import("@/components/centros/centro-mapa-view").then((mod) => mod.CentroMapaView),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full rounded-xl" /> },
);

function buildQuery(centro: Centro): string | null {
  if (!centro.direccion && !centro.localidad) return null;
  return [centro.direccion, centro.localidad, "Bogotá", "Colombia"].filter(Boolean).join(", ");
}

/**
 * "Ubicación" section for the center detail: an interactive OSM map placed by
 * geocoding the address, with the Google Maps link as the precise fallback.
 */
export function CentroMapa({ centro }: { centro: Centro }) {
  const query = buildQuery(centro);
  const { data: point, isPending, isError } = useGeocode(query);

  // Nothing to locate and no maps link → don't render an empty section.
  if (!query && !centro.linkMaps) return null;

  const comoLlegar = centro.linkMaps ? (
    <a
      href={centro.linkMaps}
      target="_blank"
      rel="noopener noreferrer"
      className="text-foreground/80 hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
    >
      Cómo llegar (Google Maps)
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  ) : null;

  return (
    <section className="space-y-2" aria-labelledby="mapa-heading">
      <h2 id="mapa-heading" className="text-lg font-semibold tracking-tight">
        Ubicación
      </h2>

      {query && isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : point ? (
        <>
          <MapaView
            lat={point.lat}
            lng={point.lng}
            nombre={centro.nombre}
            direccion={centro.direccion}
          />
          {comoLlegar}
        </>
      ) : (
        <div className="text-muted-foreground space-y-2 rounded-xl border border-dashed px-6 py-8 text-center text-sm">
          <p>{isError ? "No pudimos cargar el mapa." : "Ubicación no disponible en el mapa."}</p>
          {comoLlegar}
        </div>
      )}
    </section>
  );
}
