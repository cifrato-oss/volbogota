import { getNecesidades } from "@/data/donaciones";

function formatActualizado(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/**
 * List of donation items with a red/green status indicator and the last-updated
 * time, so donors know what each center needs right now.
 */
export function NecesidadesList({ centroId }: { centroId: string }) {
  const { insumos, actualizadoEn } = getNecesidades(centroId);

  return (
    <section className="space-y-3" aria-labelledby="necesidades-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="necesidades-heading" className="text-lg font-semibold tracking-tight">
          ¿Qué necesita este centro?
        </h2>
        <p className="text-muted-foreground text-xs">
          Última actualización: {formatActualizado(actualizadoEn)}
        </p>
      </div>

      <ul className="divide-border overflow-hidden rounded-xl border">
        {insumos.map((insumo) => {
          const necesita = insumo.estado === "NECESITA";
          return (
            <li
              key={insumo.nombre}
              className="odd:bg-muted/30 flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <span className="font-medium">{insumo.nombre}</span>
              <span
                className={cnEstado(necesita)}
                // Emoji + text so the meaning survives without color (a11y).
              >
                <span aria-hidden>{necesita ? "🔴" : "🟢"}</span>
                {necesita ? "Se necesita" : "Suficiente"}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span>
          <span aria-hidden>🔴</span> Se necesita / estamos sin este insumo.
        </span>
        <span>
          <span aria-hidden>🟢</span> Estamos bien / no se necesita ahora.
        </span>
      </div>
    </section>
  );
}

function cnEstado(necesita: boolean): string {
  return [
    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
    necesita
      ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  ].join(" ");
}
