import { ExternalLink, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { JORNADA_LABEL, JORNADA_ORDER } from "@/constants/jornadas";
import { formatNumero } from "@/lib/format-numero";
import type { Centro } from "@/types/volbogota";

/** Displays a single donation center: location, activities, and quota per shift. */
export function CentroCard({ centro }: { centro: Centro }) {
  const totalCupos = JORNADA_ORDER.reduce(
    (sum, jornada) => sum + (centro.cuposPorJornada[jornada] ?? 0),
    0,
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{centro.nombre}</CardTitle>
        <CardDescription className="flex items-center gap-1.5">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          {centro.localidad}
          {centro.direccion ? ` · ${centro.direccion}` : ""}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {centro.actividades.map((actividad) => (
            <Badge key={actividad} variant="secondary">
              {actividad}
            </Badge>
          ))}
        </div>

        <dl className="mt-auto grid grid-cols-3 gap-2 text-center">
          {JORNADA_ORDER.map((jornada) => (
            <div key={jornada} className="bg-muted/50 rounded-lg px-2 py-2">
              <dt className="text-muted-foreground text-xs">{JORNADA_LABEL[jornada]}</dt>
              <dd className="mt-0.5 font-medium tabular-nums">
                {formatNumero(centro.cuposPorJornada[jornada] ?? 0)}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>

      <CardFooter className="justify-between">
        <span className="text-muted-foreground text-xs">
          {formatNumero(totalCupos)} cupos por día
        </span>
        {centro.linkMaps ? (
          <a
            href={centro.linkMaps}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/80 hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
          >
            Ver mapa
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : null}
      </CardFooter>
    </Card>
  );
}
