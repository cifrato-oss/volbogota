"use client";

import { useState } from "react";

import { BackButton } from "@/components/shared/back-button";
import { ErrorState } from "@/components/shared/error-state";
import { BancoOption } from "@/components/sangre/banco-option";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import useBancosSangreRealtime from "@/queries/sangre/useBancosSangreRealtime";
import {
  filtrarPorTipo,
  TIPOS_SANGRE,
  type BancoSangreVista,
  type SeleccionTipo,
} from "@/types/sangre";

/**
 * The blood donation flow.
 *
 * The whole screen exists because a bank does not take every type every day, and
 * a donor has no way to know which before travelling across the city. So each
 * card answers two things the sheet actually asserts — is this point drawing
 * blood today, and which types — and nothing it does not.
 *
 * The donor's blood type never leaves this component. It is React state, not a
 * URL parameter and not `localStorage`, and the filter runs here against the
 * full list. A blood type is sensitive health data under Ley 1581; the screen
 * promises in writing that it is discarded on exit, and this is that promise
 * implemented rather than described.
 */
export function DonarSangre() {
  const { data, isPending, isError } = useBancosSangreRealtime();
  const [seleccion, setSeleccion] = useState<SeleccionTipo>(null);
  const [eligio, setEligio] = useState(false);

  const bancos = data ?? [];
  const recibiendoHoy = bancos.filter((banco) => banco.recibiendoHoy).length;

  // Ordered by what the donor can act on: the points that can take them today,
  // then the ones that might, then the ones that said no. Alphabetical inside
  // each group so the list does not reshuffle on every snapshot.
  const visibles = [...filtrarPorTipo(bancos, seleccion)].sort((a, b) => {
    const rango = (banco: BancoSangreVista) => {
      if (!banco.recibiendoHoy) return 3;
      if (seleccion && banco.tiposQueRecibe.includes(seleccion)) return 0;
      if (banco.tiposQueRecibe.length === 0) return 1;
      return 2;
    };
    return rango(a) - rango(b) || a.nombre.localeCompare(b.nombre, "es");
  });

  return (
    <div className="space-y-6">
      <BackButton href="/">Volver al inicio</BackButton>

      {/*
        One accent, spent in one place. The rose belongs to this module — the
        landing already assigns it — but four tinted states at once read as
        decoration rather than meaning, so everything here stays neutral and the
        colour is saved for the two things a donor acts on: the type they picked,
        and the points that can take it.
      */}
      <header className="space-y-1.5 border-l-2 border-rose-500 pl-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Quiero donar sangre</h1>
        <p className="text-muted-foreground text-sm text-pretty">
          Cada punto recibe tipos distintos según el día. Mira en un minuto si pueden recibir el
          tuyo.
        </p>
        {!isPending && !isError && bancos.length > 0 ? (
          <p className="text-muted-foreground flex items-center gap-1.5 pt-0.5 text-xs">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span>
              <span className="font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                {recibiendoHoy}
              </span>{" "}
              de <span className="tabular-nums">{bancos.length}</span> puntos están recibiendo ahora
            </span>
          </p>
        ) : null}
      </header>

      {/*
        The warmth lives in the buttons and nowhere else on this panel: this is
        the one block a donor touches, and eight grey buttons for eight blood
        types was the palette working against the subject.
      */}
      <section className="bg-card space-y-4 rounded-2xl border p-5">
        <div className="space-y-1">
          <h2 className="font-heading text-lg font-semibold">¿Sabes tu tipo de sangre?</h2>
          <p className="text-muted-foreground text-sm text-pretty">
            Si no lo sabes, igual puedes donar: te lo dicen ahí.
          </p>
        </div>

        {/* Four across even on the narrowest phone: the labels are two
            characters, and two columns turned this into four rows of scroll
            before the donor reached a single point. */}
        <div className="grid grid-cols-4 gap-2">
          {TIPOS_SANGRE.map((tipo) => {
            const activo = eligio && seleccion === tipo;
            return (
              <button
                key={tipo}
                type="button"
                aria-pressed={activo}
                onClick={() => {
                  // Volver a tocar el tipo activo lo suelta. Es el único camino
                  // de vuelta a la lista completa, y un botón que se ve
                  // presionado promete justamente eso.
                  const yaEstaba = eligio && seleccion === tipo;
                  setSeleccion(yaEstaba ? null : tipo);
                  setEligio(!yaEstaba);
                }}
                className={cn(
                  "rounded-xl border px-2 py-3 text-base font-semibold tabular-nums transition-all",
                  "focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:outline-none",
                  // Chosen reads by weight and by a ring, not by a slab of
                  // colour: the picker is eight buttons wide, and a solid fill
                  // on one of them shouted louder than anything else on the
                  // screen — including the points it was supposed to be
                  // filtering.
                  activo
                    ? "border-rose-400 bg-rose-100/80 text-rose-800 ring-2 ring-rose-400/40 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-100 dark:ring-rose-700/40"
                    : "border-rose-200/70 bg-rose-50/40 text-rose-900/80 hover:border-rose-300 hover:bg-rose-100/60 dark:border-rose-900/50 dark:bg-rose-950/15 dark:text-rose-200/80 dark:hover:bg-rose-950/35",
                )}
              >
                {tipo.replace("-", "−")}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          aria-pressed={eligio && seleccion === null}
          onClick={() => {
            // Unpresses like the type buttons do. Both land on the same list, so
            // the difference is only that the control stops looking chosen —
            // which is the whole reason it looked wrong.
            setSeleccion(null);
            setEligio(!(eligio && seleccion === null));
          }}
          className={cn(
            "w-full rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            eligio && seleccion === null
              ? "border-foreground/40 bg-muted"
              : "hover:border-foreground/30 hover:bg-muted/50",
          )}
        >
          No lo sé
        </button>

        <p className="text-muted-foreground bg-muted/50 flex gap-2 rounded-lg px-3 py-2 text-xs text-pretty">
          <span aria-hidden>🔒</span>
          <span>
            <strong className="text-foreground font-medium">Tu tipo de sangre no se guarda.</strong>{" "}
            Se usa solo para filtrar los puntos de esta pantalla y se descarta al salir.
          </span>
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading flex items-center gap-2 text-lg font-semibold">
            {eligio && seleccion ? (
              <>
                <span>Puntos para</span>
                {/* The chosen type follows the donor down the page, so the list
                    never stops saying which question it is answering. */}
                <span className="rounded-md border border-rose-300 bg-rose-100/80 px-2 py-0.5 text-base text-rose-800 tabular-nums dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100">
                  {seleccion.replace("-", "−")}
                </span>
              </>
            ) : (
              "Puntos de donación"
            )}
          </h2>
          {!isPending && !isError ? (
            <span className="text-muted-foreground text-xs tabular-nums">
              {visibles.length} de {bancos.length}
            </span>
          ) : null}
        </div>

        {isError ? (
          <ErrorState message="No pudimos cargar los puntos de donación." />
        ) : isPending ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[124px] rounded-xl" />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <p className="text-muted-foreground bg-muted/40 rounded-2xl border p-5 text-sm text-pretty">
            Ningún punto está recibiendo tu tipo hoy. Eso no significa que no puedan recibirte:
            llama al punto antes de desplazarte.
          </p>
        ) : (
          /*
            The list scrolls inside itself rather than pushing the page down.
            With a couple of dozen banks the picker would otherwise scroll out of
            reach, and changing your blood type is the thing a donor does most on
            this screen — it has to stay where they left it. `overscroll-contain`
            stops the page from taking over once the list bottoms out.
          */
          /*
            Sized to what is left of the viewport rather than to a guessed
            fraction of it. `68vh` made the page scroll and the list scroll at
            the same time, and two bars for one screen is worse than either.
            Subtracting what sits above — header, picker, section title — leaves
            the page roughly still and the list as the only thing that moves.

            `dvh` and not `vh`: on a phone the browser chrome hides as you
            scroll, and `vh` would size against a viewport that is not there yet.
            The floor keeps it usable on a short screen, where the page scrolls
            again and that is the right answer.
          */
          <div className="max-h-[calc(100dvh-31rem)] min-h-80 overflow-y-auto overscroll-contain pr-1">
            {/*
              One column, unlike the centre picker this borrows its card from.
              That screen is a gallery — six known places, pick one. This is a
              filtered result, read by running an eye down the state column
              asking "does this one take me", and a second column turns that
              straight line into a zigzag.
            */}
            <ul className="space-y-3">
              {visibles.map((banco) => (
                <li key={banco.id}>
                  <BancoOption banco={banco} seleccion={eligio ? seleccion : null} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
