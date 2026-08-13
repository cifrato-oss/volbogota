import { ArrowRight, MapPin } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { JORNADA_ORDER } from "@/constants/jornadas";
import { formatNumero } from "@/lib/format-numero";
import type { Centro } from "@/types/volbogota";

type CentroOptionProps = {
  centro: Centro;
  /** Where tapping this center goes, e.g. `/centros/vive-claro`. */
  href: string;
};

/** A center in the picker. Tapping it navigates straight to the center page. */
export function CentroOption({ centro, href }: CentroOptionProps) {
  const totalCupos = JORNADA_ORDER.reduce(
    (sum, jornada) => sum + (centro.cuposPorJornada[jornada] ?? 0),
    0,
  );
  const ubicacion = [centro.localidad, centro.direccion].filter(Boolean).join(" · ");

  return (
    <Link
      href={href}
      className="group bg-card border-border hover:border-foreground/25 focus-visible:ring-ring flex h-full flex-col rounded-xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 leading-snug font-medium">{centro.nombre}</h3>
        <ArrowRight
          className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>

      {ubicacion ? (
        <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{ubicacion}</span>
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {centro.actividades.map((actividad) => (
          <Badge key={actividad} variant="secondary">
            {actividad}
          </Badge>
        ))}
      </div>

      <p className="text-muted-foreground mt-3 pt-1 text-xs md:mt-auto">
        {formatNumero(totalCupos)} cupos por día
      </p>
    </Link>
  );
}
