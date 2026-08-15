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

      <header className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Quiero donar sangre</h1>
        <p className="text-muted-foreground text-sm text-pretty">
          Hoy algunos puntos solo están recibiendo tipos específicos. Mira en un minuto si pueden
          recibir el tuyo.
        </p>
      </header>

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
                  "rounded-xl border px-2 py-3 text-base font-semibold tabular-nums transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  activo
                    ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                    : "hover:border-foreground/30 hover:bg-muted/50",
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
            setSeleccion(null);
            setEligio(true);
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
          <h2 className="font-heading text-lg font-semibold">
            {eligio && seleccion
              ? `Puntos para ${seleccion.replace("-", "−")}`
              : "Puntos de donación"}
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
          <div className="max-h-[68vh] overflow-y-auto overscroll-contain pr-1">
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
