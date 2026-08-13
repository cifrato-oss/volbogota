"use client";

import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import useNecesidadesRealtime from "@/queries/donaciones/useNecesidadesRealtime";
import type { NecesidadesDeCentro, Semaforo } from "@/types/donaciones";

const SEMAFORO_UI: Record<Semaforo, { emoji: string; label: string; className: string }> = {
  ROJO: {
    emoji: "🔴",
    label: "Se necesita",
    className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  },
  VERDE: {
    emoji: "🟢",
    label: "Suficiente",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  GRIS: {
    emoji: "⚪",
    label: "No aplica",
    className: "bg-muted text-muted-foreground",
  },
};

function ultimaActualizacion(data: NecesidadesDeCentro): string | null {
  const fechas = data.categorias
    .flatMap((categoria) => categoria.elementos.map((elemento) => elemento.actualizadoEn))
    .filter((fecha): fecha is string => Boolean(fecha));

  if (fechas.length === 0) return null;

  const maxIso = fechas.reduce((a, b) => (a > b ? a : b));
  const date = new Date(maxIso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function SemaforoBadge({ semaforo }: { semaforo: Semaforo }) {
  const ui = SEMAFORO_UI[semaforo];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        ui.className,
      )}
    >
      <span aria-hidden>{ui.emoji}</span>
      {ui.label}
    </span>
  );
}

/**
 * Live donation needs for a center: every catalogue item grouped by category,
 * each with its real-time status and the last-updated time. Data comes from
 * `/api/donaciones/necesidades` and refreshes instantly via the Firestore
 * subscription (RealtimeProvider).
 */
export function NecesidadesList({ centroId }: { centroId: string }) {
  const { data, isPending, isError } = useNecesidadesRealtime(centroId);

  if (isError) {
    return <ErrorState message="No pudimos cargar las necesidades de este centro." />;
  }

  if (isPending || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  const actualizado = ultimaActualizacion(data);

  return (
    <section className="space-y-5" aria-labelledby="necesidades-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="necesidades-heading" className="text-lg font-semibold tracking-tight">
          ¿Qué necesita este centro?
        </h2>
        {actualizado ? (
          <p className="text-muted-foreground text-xs">Última actualización: {actualizado}</p>
        ) : null}
      </div>

      {data.categorias.map((categoria) => (
        <div key={categoria.categoria} className="space-y-2">
          <h3 className="font-medium">{categoria.categoria}</h3>
          {categoria.mensaje ? (
            <p className="text-muted-foreground text-xs">{categoria.mensaje}</p>
          ) : null}
          <ul className="divide-border overflow-hidden rounded-xl border">
            {categoria.elementos.map((elemento) => (
              <li
                key={elemento.id}
                className="odd:bg-muted/30 flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="font-medium">{elemento.elemento}</span>
                <SemaforoBadge semaforo={elemento.semaforo} />
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>
          <span aria-hidden>🔴</span> Se necesita / estamos sin este insumo.
        </span>
        <span>
          <span aria-hidden>🟢</span> Suficiente / no se necesita ahora.
        </span>
        <span>
          <span aria-hidden>⚪</span> No aplica en este centro.
        </span>
      </div>
    </section>
  );
}
