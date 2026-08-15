import { ArrowUpRight, Clock, MapPin } from "lucide-react";

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
          "border-border relative border-b px-8 py-3 transition-colors",
          recibeElTuyo
            ? "bg-emerald-50 dark:bg-emerald-950/30"
            : "bg-muted/40 group-hover:bg-primary/5",
        )}
      >
        <h3 className="text-center leading-snug font-semibold tracking-tight text-balance">
          {banco.nombre}
        </h3>
        {banco.linkMaps ? (
          <ArrowUpRight
            className="text-muted-foreground group-hover:text-primary absolute top-1/2 right-3 size-4 -translate-y-1/2 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
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
        </div>

        <EstadoBanco banco={banco} recibeElTuyo={recibeElTuyo} seleccion={seleccion} />

        {banco.recibiendoHoy && banco.tiposQueRecibe.length > 0 ? (
          <div className="border-border -mx-4 mt-auto space-y-1.5 border-t px-4 pt-3">
            <p className="text-foreground text-sm font-semibold">Tipos que recibe hoy</p>
            <ul className="flex flex-wrap gap-1.5">
              {banco.tiposQueRecibe.map((tipo) => {
                const esElTuyo = tipo === seleccion;
                return (
                  <li
                    key={tipo}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
                      esElTuyo ? "bg-emerald-500 text-white" : "bg-muted/60 text-muted-foreground",
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

  const clases = cn(
    "group bg-card border-border flex h-full flex-col overflow-hidden rounded-xl border transition-all",
    banco.linkMaps &&
      "hover:border-primary focus-visible:border-primary focus-visible:ring-primary/30 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none",
    recibeElTuyo && "border-emerald-500/60",
    !banco.recibiendoHoy && "opacity-75",
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
    if (banco.tiposQueRecibe.length === 0) {
      return {
        punto: "bg-amber-500",
        color: "text-amber-600 dark:text-amber-400",
        texto: "Recibiendo · tipos sin confirmar",
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
      punto: "bg-rose-500",
      color: "text-rose-600 dark:text-rose-400",
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
