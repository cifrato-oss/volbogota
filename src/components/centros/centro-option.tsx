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
      className="group bg-card border-border hover:border-foreground/25 focus-visible:ring-ring flex h-full flex-col gap-3 rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="leading-snug font-medium">{centro.nombre}</h3>
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
        <ArrowRight
          className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>

      <EstadoActivo activo={centro.activo} />

      {mostrarCupos ? (
        <dl className="mt-auto grid grid-cols-2 gap-2 text-center">
          {JORNADAS_VOLUNTARIADO.map((jornada) => (
            <div key={jornada} className="bg-muted/50 rounded-lg px-2 py-1.5">
              <dt className="text-muted-foreground text-[11px]">
                <span aria-hidden>{JORNADA_STYLE[jornada].emoji}</span> {JORNADA_LABEL[jornada]}
              </dt>
              <dd className="font-medium tabular-nums">
                {formatNumero(centro.cuposPorJornada[jornada] ?? 0)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Link>
  );
}
