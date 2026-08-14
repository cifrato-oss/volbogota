import { ArrowRight, Clock, MapPin } from "lucide-react";
import Link from "next/link";

import { JORNADA_LABEL, JORNADA_STYLE, JORNADAS_VOLUNTARIADO } from "@/constants/jornadas";
import { formatNumero } from "@/lib/format-numero";
import { cn } from "@/lib/utils";
import type { Centro } from "@/types/volbogota";

type CentroOptionProps = {
  centro: Centro;
  /** Where tapping this center goes, e.g. `/centros/vive-claro`. */
  href: string;
  /** Show cupos per shift — relevant when volunteering, not when donating. */
  mostrarCupos?: boolean;
};

function EstadoActivo({ activo }: { activo: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium">
      <span className="relative flex size-2.5" aria-hidden>
        {activo ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        ) : null}
        <span
          className={cn(
            "relative inline-flex size-2.5 rounded-full",
            activo ? "bg-emerald-500" : "bg-muted-foreground/40",
          )}
        />
      </span>
      <span className={activo ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
        {activo ? "Activo" : "Inactivo"}
      </span>
    </span>
  );
}

/** A center in the picker. Tapping it navigates straight to the center page. */
export function CentroOption({ centro, href, mostrarCupos = true }: CentroOptionProps) {
  const ubicacion = [centro.localidad, centro.direccion].filter(Boolean).join(" · ");

  return (
    <Link
      href={href}
      className="group bg-card border-border hover:border-primary focus-visible:border-primary focus-visible:ring-primary/30 flex h-full flex-col overflow-hidden rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="border-border bg-muted/40 group-hover:bg-primary/5 relative border-b px-8 py-3 transition-colors">
        <h3 className="text-center leading-snug font-semibold tracking-tight">{centro.nombre}</h3>
        <ArrowRight
          className="text-muted-foreground group-hover:text-primary absolute top-1/2 right-3 size-4 -translate-y-1/2 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          {ubicacion ? (
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{ubicacion}</span>
            </p>
          ) : null}
          {centro.horarioOficial ? (
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{centro.horarioOficial}</span>
            </p>
          ) : null}
        </div>

        <EstadoActivo activo={centro.activo} />

        {mostrarCupos ? (
          <dl className="mt-auto grid grid-cols-2 gap-2 text-center">
            {JORNADAS_VOLUNTARIADO.map((jornada) => {
              const cupos = centro.cuposPorJornada[jornada] ?? 0;
              return (
                <div key={jornada} className="bg-muted/50 rounded-lg px-2 py-1.5">
                  <dt className="text-muted-foreground text-[11px]">
                    <span aria-hidden>{JORNADA_STYLE[jornada].emoji}</span> {JORNADA_LABEL[jornada]}
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {formatNumero(cupos)}{" "}
                    <span className="text-muted-foreground text-[11px] font-normal">
                      {cupos === 1 ? "cupo" : "cupos"}
                    </span>
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : null}
      </div>
    </Link>
  );
}
