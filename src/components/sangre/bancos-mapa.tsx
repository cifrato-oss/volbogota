"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ChevronDown, Map } from "lucide-react";

import { ErrorBoundary } from "@/components/shared/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { BancoSangreVista } from "@/types/sangre";

const MapaView = dynamic(
  () => import("@/components/sangre/bancos-mapa-view").then((mod) => mod.BancosMapaView),
  { ssr: false, loading: () => <Skeleton className="h-72 w-full rounded-xl" /> },
);

/**
 * One map for the whole list, not one per card.
 *
 * Sixteen cards would mean sixteen Leaflet instances and sixteen geocoding
 * requests, and Nominatim asks for about one request a second — the page would
 * crawl and still be a poor answer, since the question a map settles here is
 * "which of these is near me", which is about the set and not about any single
 * point.
 *
 * Collapsed by default. Most donors filter by type first and never need it, and
 * an unfolded map would push the list itself below the fold. Opening it is also
 * what starts the geocoding, so a donor who does not ask for the map never pays
 * for it.
 */
export function BancosMapa({
  bancos,
  coincideCon,
}: {
  bancos: BancoSangreVista[];
  coincideCon: (banco: BancoSangreVista) => boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  if (bancos.length === 0) return null;

  return (
    <section className="space-y-2">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((valor) => !valor)}
        className="hover:bg-muted/60 focus-visible:ring-ring flex w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Map className="size-4 shrink-0" aria-hidden />
        <span>Ver {bancos.length === 1 ? "el punto" : "los puntos"} en el mapa</span>
        <ChevronDown
          className={cn("ml-auto size-4 transition-transform", abierto && "rotate-180")}
          aria-hidden
        />
      </button>

      {abierto ? (
        <ErrorBoundary
          fallback={
            <p className="text-muted-foreground rounded-xl border border-dashed px-6 py-8 text-center text-sm">
              No pudimos cargar el mapa. Cada punto tiene su enlace a Google Maps.
            </p>
          }
        >
          <MapaView bancos={bancos} coincideCon={coincideCon} />
          <p className="text-muted-foreground text-xs">
            Los pines se ubican por dirección, así que pueden quedar a media cuadra. Para llegar,
            usa el enlace de cada punto.
          </p>
        </ErrorBoundary>
      ) : null}
    </section>
  );
}
