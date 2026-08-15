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
  const estado = estadoDeBanco(banco, seleccion);

  const contenido = (
    <>
      <div
        className={cn(
          "border-border bg-muted/40 flex items-center justify-between gap-3 border-b px-4 py-3 transition-colors",
          estado.hover,
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

          <BadgeEstado estado={estado} />
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

  // A coloured top border per state, the way `JORNADA_STYLE` marks a shift card.
  // Colour lands in exactly two places on this card — this edge and the badge —
  // which is the discipline that keeps four states from reading as decoration.
  const clases = cn(
    "group bg-card border-border flex h-full flex-col overflow-hidden rounded-xl border border-t-4 transition-all",
    estado.topBorder,
    banco.linkMaps &&
      "hover:border-foreground/25 focus-visible:ring-primary/30 hover:shadow-sm focus-visible:ring-2 focus-visible:outline-none",
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
 * What the card says about a point, in the shape the rest of the app uses for
 * state: an emoji, a label, and a tinted pill — the same construction as
 * `SemaforoBadge` on the donations screen.
 *
 * Two colours and no more. Green is "you can go there today", grey is "not
 * today", and every finer distinction lives in the text. An earlier version gave
 * amber to a point with no types listed and rose to one taking specific types,
 * which turned two perfectly good options into warnings — a donor reading amber
 * concludes "open, but… careful", when the sheet said nothing of the kind.
 */
type EstadoBanco = {
  emoji: string;
  texto: string;
  badge: string;
  /** Top border, the way `JORNADA_STYLE` marks a shift card. */
  topBorder: string;
  /** Hover wash for the name band — lighter, never darker. */
  hover: string;
};

export function estadoDeBanco(banco: BancoSangreVista, seleccion: SeleccionTipo): EstadoBanco {
  if (!banco.recibiendoHoy) {
    return {
      emoji: "⚪",
      texto: "Hoy no está recibiendo",
      badge: "bg-muted text-muted-foreground",
      topBorder: "border-t-muted-foreground/30",
      hover: "group-hover:bg-muted/20",
    };
  }

  const verde = {
    emoji: "🟢",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    topBorder: "border-t-emerald-500",
    // Hover lightens into the state's own colour. The band used to go from
    // `bg-muted/40` to `bg-muted/70` — darker grey, which reads as the card
    // dimming under the cursor instead of responding to it.
    hover: "group-hover:bg-emerald-50/70 dark:group-hover:bg-emerald-950/25",
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

function BadgeEstado({ estado }: { estado: EstadoBanco }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        estado.badge,
      )}
    >
      <span aria-hidden>{estado.emoji}</span>
      {estado.texto}
    </span>
  );
}
