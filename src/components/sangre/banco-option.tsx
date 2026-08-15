import { Clock, ExternalLink, MapPin, MapPinned } from "lucide-react";

import { cn } from "@/lib/utils";
import type { BancoSangreVista, SeleccionTipo } from "@/types/sangre";

/**
 * A blood bank in the list, built in the same language as `CentroOption`.
 *
 * Same header band, same `MapPin`/`Clock` body, same chip strip under a rule —
 * the difference is what the chips hold. A centre shows capacity per shift; a
 * bank shows the types it is taking, with the donor's own type marked among
 * them. That is the one comparison this screen exists to make, and spelling the
 * types out beats summarising them: "O−, A−, B−, AB−" tells a B− donor more
 * than "RH−" does, even though the coordinator wrote the second.
 *
 * The card itself is not a link, unlike `CentroOption`. That one opens a page
 * inside the app; a bank has no page of its own and its only destination is
 * Google Maps, so only the "Cómo llegar" button carries it. A stray tap on a
 * card should never eject someone from the site.
 */
export function BancoOption({
  banco,
  seleccion,
}: {
  banco: BancoSangreVista;
  seleccion: SeleccionTipo;
}) {
  const ubicacion = [banco.localidad, banco.direccion].filter(Boolean).join(" · ");
  const estado = estadoDeBanco(banco, seleccion);
  const esElSuyo = Boolean(
    seleccion && banco.recibiendoHoy && banco.tiposQueRecibe.includes(seleccion),
  );

  return (
    <div
      className={cn(
        "bg-card border-border flex h-full flex-col overflow-hidden rounded-xl border transition-colors",
        // The one card that answers the donor's question gets the full border and
        // a wash, the way the centre picker marks the shift you chose. Every
        // other card stays neutral: a coloured edge on all nineteen marked
        // nothing, because a marker that is on almost everything is background.
        esElSuyo && "border-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/15",
        !banco.recibiendoHoy && "opacity-70",
      )}
    >
      <div
        className={cn(
          "border-border bg-muted/40 flex items-center justify-between gap-3 border-b px-4 py-3",
        )}
      >
        {/* Left-aligned, unlike the centre card it borrows from: centring reads
            as a title on a narrow card and as a stray line on a wide row. */}
        <h3 className="leading-snug font-semibold tracking-tight text-balance">{banco.nombre}</h3>

        {/*
          The only clickable thing on the card, and deliberately so.
          `CentroOption` makes the whole card a link, but its destination is a
          page inside the app — this one hands the donor to Google Maps, and a
          stray tap anywhere on a card should not eject someone from the site.
          Naming the destination and carrying the external-link mark is the rest
          of that promise.
        */}
        {banco.linkMaps ? (
          <a
            href={banco.linkMaps}
            target="_blank"
            rel="noreferrer"
            className="border-border bg-background text-foreground focus-visible:ring-primary/30 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:border-emerald-400 hover:bg-emerald-50 focus-visible:ring-2 focus-visible:outline-none dark:hover:bg-emerald-950/30"
          >
            <MapPinned className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Cómo llegar</span>
            <span className="sm:hidden">Maps</span>
            <ExternalLink className="text-muted-foreground size-3" aria-hidden />
            <span className="sr-only">a {banco.nombre}, se abre en Google Maps</span>
          </a>
        ) : null}
      </div>

      {/*
        Side by side once there is room, stacked on a phone. In one column the
        card is wide, and stacking location above types would leave a long empty
        gutter down the right of every row.
      */}
      <div className="flex flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="min-w-0 flex-1 space-y-1.5">
          {ubicacion ? (
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{ubicacion}</span>
            </p>
          ) : null}
          {banco.horarioOficial ? (
            <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{banco.horarioOficial}</span>
            </p>
          ) : null}

          <BadgeEstado estado={estado} destacar={esElSuyo} />
        </div>

        {banco.recibiendoHoy && banco.tiposQueRecibe.length > 0 ? (
          <div className="border-border -mx-4 space-y-1.5 border-t px-4 pt-3 sm:mx-0 sm:max-w-[52%] sm:border-t-0 sm:border-l sm:px-0 sm:pt-0 sm:pl-6">
            <p className="text-foreground text-sm font-semibold">Tipos que recibe hoy</p>
            <ul className="flex flex-wrap gap-1.5">
              {banco.tiposQueRecibe.map((tipo) => {
                const esElTuyo = tipo === seleccion;
                return (
                  <li
                    key={tipo}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                      esElTuyo
                        ? "bg-emerald-600 text-white"
                        : "bg-muted text-muted-foreground border",
                    )}
                  >
                    {tipo.replace("-", "−")}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * What the card says about a point: a dot and a label, exactly `CentroOption`'s
 * "● Activo".
 *
 * Two colours and no more. Green is "you can go there today", grey is "not
 * today", and every finer distinction lives in the text. An earlier version gave
 * amber to a point with no types listed and rose to one taking specific types,
 * which turned two perfectly good options into warnings — a donor reading amber
 * concludes "open, but… careful", when the sheet said nothing of the kind.
 */
type EstadoBanco = {
  texto: string;
  /** Dot colour. */
  punto: string;
  /** Label colour. */
  color: string;
};

export function estadoDeBanco(banco: BancoSangreVista, seleccion: SeleccionTipo): EstadoBanco {
  if (!banco.recibiendoHoy) {
    return {
      texto: "Hoy no está recibiendo",
      punto: "bg-muted-foreground/40",
      color: "text-muted-foreground",
    };
  }

  const verde = {
    punto: "bg-emerald-500",
    color: "text-emerald-600 dark:text-emerald-400",
  };

  if (seleccion && banco.tiposQueRecibe.includes(seleccion)) {
    return { ...verde, texto: `Recibe ${seleccion.replace("-", "−")} hoy` };
  }

  // Still green, even with no types listed. Amber read as a warning on a point
  // that is drawing blood — "they're open, but… CAREFUL" — which is the
  // opposite of what the sheet says. The colour answers one question, "can I go
  // there today", and the text carries everything finer than that.
  if (banco.tiposQueRecibe.length === 0) {
    return { ...verde, texto: "Recibiendo · sin lista de tipos" };
  }

  return { ...verde, texto: "Recibiendo hoy" };
}

/** The dot-and-label `CentroOption` uses for "Activo", with this screen's states. */
function BadgeEstado({ estado, destacar }: { estado: EstadoBanco; destacar: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium">
      <span className="relative flex size-2.5" aria-hidden>
        {destacar ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        ) : null}
        <span className={cn("relative inline-flex size-2.5 rounded-full", estado.punto)} />
      </span>
      <span className={estado.color}>{estado.texto}</span>
    </span>
  );
}
