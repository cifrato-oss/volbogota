import { Check, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { JORNADA_ORDER } from "@/constants/jornadas";
import { formatNumero } from "@/lib/format-numero";
import { cn } from "@/lib/utils";
import type { Centro } from "@/types/volbogota";

type CentroOptionProps = {
  centro: Centro;
  selected: boolean;
  onSelect: (id: string) => void;
};

/**
 * Selectable center in the "choose a center" flow. Rendered as a full-width,
 * tappable card — the primary target on mobile.
 */
export function CentroOption({ centro, selected, onSelect }: CentroOptionProps) {
  const totalCupos = JORNADA_ORDER.reduce(
    (sum, jornada) => sum + (centro.cuposPorJornada[jornada] ?? 0),
    0,
  );

  return (
    <button
      type="button"
      onClick={() => onSelect(centro.id)}
      aria-pressed={selected}
      className={cn(
        "bg-card flex h-full w-full flex-col rounded-xl border p-4 text-left transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        selected
          ? "border-primary ring-primary/40 ring-2"
          : "border-border hover:border-foreground/25",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="leading-snug font-medium">{centro.nombre}</h3>
          <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {centro.localidad}
              {centro.direccion ? ` · ${centro.direccion}` : ""}
            </span>
          </p>
        </div>

        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
          )}
        >
          {selected ? <Check className="size-3.5" /> : null}
        </span>
      </div>

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
    </button>
  );
}
