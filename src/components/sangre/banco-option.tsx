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
 * The whole card opens Maps, the way a centre card opens its page. A bank has no
 * page of its own, and directions are the next thing a donor wants.
 */
export function BancoOption({
  banco,
  seleccion,
}: {
  banco: BancoSangreVista;
  seleccion: SeleccionTipo;
}) {
  const ubicacion = [banco.localidad, banco.direccion].filter(Boolean).join(" · ");
  const recibeElTuyo = Boolean(
    seleccion && banco.recibiendoHoy && banco.tiposQueRecibe.includes(seleccion),
  );

  const contenido = (
    <>
      <div
        className={cn(
          "border-border bg-muted/40 group-hover:bg-muted/70 flex items-center justify-between gap-3 border-b px-4 py-3 transition-colors",
        )}
      >
        {/* Left-aligned, unlike the centre card it borrows from: centring reads
            as a title on a narrow card and as a stray line on a wide row. */}
        <h3 className="leading-snug font-semibold tracking-tight text-balance">{banco.nombre}</h3>

        {/*
          A bare arrow said neither where it goes nor that it leaves the app. The
          whole card opens Maps, so the affordance names the destination and
          carries the external-link mark — a donor tapping this ends up in
          another app, and that should never be a surprise.
        */}
        {banco.linkMaps ? (
          <span className="border-border bg-background text-foreground group-hover:border-foreground/30 inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors">
            <MapPinned className="size-3.5" aria-hidden />
            <span className="hidden sm:inline">Cómo llegar</span>
            <span className="sm:hidden">Maps</span>
            <ExternalLink className="text-muted-foreground size-3" aria-hidden />
          </span>
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

          <EstadoBanco banco={banco} recibeElTuyo={recibeElTuyo} seleccion={seleccion} />
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
    </>
  );

  // Only the match is marked, and only on its edge. Giving every state its own
  // coloured rail turned the list into four competing colours, which is
  // decoration: a donor scanning for "can I go here" needs one thing to stand
  // out, not four things insisting at once.
  const clases = cn(
    "group bg-card border-border flex h-full flex-col overflow-hidden rounded-xl border transition-all",
    banco.linkMaps &&
      "hover:border-foreground/25 focus-visible:ring-primary/30 hover:shadow-sm focus-visible:ring-2 focus-visible:outline-none",
    recibeElTuyo && "border-l-2 border-l-emerald-500",
    !banco.recibiendoHoy && "opacity-70",
  );

  if (!banco.linkMaps) return <div className={clases}>{contenido}</div>;

  return (
    <a className={clases} href={banco.linkMaps} target="_blank" rel="noreferrer">
      {contenido}
    </a>
  );
}

/**
 * The dot-and-label the rest of the app uses for state, with this screen's three.
 *
 * "Sin confirmar" is not a softer "no": the point is open and simply has not
 * said what it is taking, so a donor can still go. Collapsing the two would tell
 * them not to bother.
 */
function EstadoBanco({
  banco,
  recibeElTuyo,
  seleccion,
}: {
  banco: BancoSangreVista;
  recibeElTuyo: boolean;
  seleccion: SeleccionTipo;
}) {
  const { punto, texto, color } = (() => {
    if (!banco.recibiendoHoy) {
      return {
        punto: "bg-muted-foreground/40",
        color: "text-muted-foreground",
        texto: "Hoy no está recibiendo",
      };
    }
    // Open, but nobody filled the types cell. A hollow dot rather than another
    // colour: it had the same grey as a closed point, and the two say opposite
    // things — this one is "go, they will probably take you".
    if (banco.tiposQueRecibe.length === 0) {
      return {
        punto: "border-foreground/50 border-2 bg-transparent",
        color: "text-foreground/80",
        texto: "Recibiendo · no especificó tipos",
      };
    }
    if (recibeElTuyo) {
      return {
        punto: "bg-emerald-500",
        color: "text-emerald-600 dark:text-emerald-400",
        texto: `Recibe ${seleccion?.replace("-", "−")} hoy`,
      };
    }
    return {
      punto: "bg-foreground/60",
      color: "text-foreground/80",
      texto: "Recibiendo tipos específicos",
    };
  })();

  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium">
      <span className="relative flex size-2.5" aria-hidden>
        {recibeElTuyo ? (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        ) : null}
        <span className={cn("relative inline-flex size-2.5 rounded-full", punto)} />
      </span>
      <span className={color}>{texto}</span>
    </span>
  );
}
