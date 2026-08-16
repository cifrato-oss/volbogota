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
 * A map per card would answer the wrong question. What a map settles here is
 * "which of these is near me", which is about the set.
 *
 * Only banks with stored coordinates get a pin, and the button says how many
 * that is. Points whose Maps link carried no coordinates are simply absent from
 * it — dropping them somewhere approximate would put a pin on a place the bank
 * is not, and a donor has no way to tell an approximate pin from an exact one.
 *
 * Collapsed by default: most donors filter by type and never need it, and an
 * unfolded map pushes the list below the fold.
 */
export function BancosMapa({
  bancos,
  coincideCon,
}: {
  bancos: BancoSangreVista[];
  coincideCon: (banco: BancoSangreVista) => boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const ubicados = bancos.filter((banco) => banco.lat != null && banco.lng != null);

  if (ubicados.length === 0) return null;

  return (
    <section className="space-y-2">
      <button
        type="button"
        aria-expanded={abierto}
        onClick={() => setAbierto((valor) => !valor)}
        className="hover:bg-muted/60 focus-visible:ring-ring flex w-full items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Map className="size-4 shrink-0" aria-hidden />
        <span>
          Ver {ubicados.length === 1 ? "el punto" : `los ${ubicados.length} puntos`} en el mapa
        </span>
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
          <MapaView bancos={ubicados} coincideCon={coincideCon} />
          {ubicados.length < bancos.length ? (
            <p className="text-muted-foreground text-xs">
              {bancos.length - ubicados.length} de estos puntos no tiene ubicación en el mapa.
              Siguen en la lista, con su enlace para llegar.
            </p>
          ) : null}
        </ErrorBoundary>
      ) : null}
    </section>
  );
}
