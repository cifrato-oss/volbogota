"use client";

import { useState } from "react";

import { BackButton } from "@/components/shared/back-button";
import { ErrorState } from "@/components/shared/error-state";
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

      <section className="bg-card space-y-3 rounded-2xl border p-4">
        <div className="space-y-0.5">
          <h2 className="font-heading text-base font-semibold">¿Sabes tu tipo de sangre?</h2>
          <p className="text-muted-foreground text-xs text-pretty">
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
                  "rounded-lg border px-2 py-2.5 text-sm font-semibold tabular-nums transition-colors",
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
            "w-full rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
            "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            eligio && seleccion === null
              ? "border-foreground/40 bg-muted"
              : "hover:border-foreground/30 hover:bg-muted/50",
          )}
        >
          No lo sé
        </button>

        <p className="text-muted-foreground flex gap-1.5 text-[11px] text-pretty">
          <span aria-hidden>🔒</span>
          <span>
            <strong className="text-foreground font-medium">Tu tipo no se guarda.</strong> Se usa
            solo para filtrar esta pantalla y se descarta al salir.
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
          <div className="bg-card divide-y overflow-hidden rounded-2xl border">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[74px] rounded-none" />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <p className="text-muted-foreground bg-muted/40 rounded-2xl border p-5 text-sm text-pretty">
            Ningún punto está recibiendo tu tipo hoy. Eso no significa que no puedan recibirte:
            llama al punto antes de desplazarte.
          </p>
        ) : (
          /*
            One bordered container with divided rows, not sixteen separate cards.
            With a handful of points the cards read fine; past a dozen, every
            border and gap is scroll the donor pays for, and the list stops
            scanning as a list.
          */
          <ul className="bg-card divide-y overflow-hidden rounded-2xl border">
            {visibles.map((banco) => (
              <TarjetaBanco key={banco.id} banco={banco} seleccion={eligio ? seleccion : null} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TarjetaBanco({ banco, seleccion }: { banco: BancoSangreVista; seleccion: SeleccionTipo }) {
  // A bank that is receiving and lists the chosen type is the one to walk into,
  // so it gets the border. Everything else stays quiet.
  const recibeElTuyo = Boolean(
    seleccion && banco.recibiendoHoy && banco.tiposQueRecibe.includes(seleccion),
  );

  return (
    <li
      className={cn(
        "relative p-4 pl-5 transition-colors",
        // The match gets a left rail rather than a full border: inside a divided
        // list a ring would fight the dividers, and a rail is what the eye picks
        // up when scanning straight down the edge.
        recibeElTuyo &&
          "bg-rose-50/40 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-rose-500 dark:bg-rose-950/20",
        // A closed point stays in the list and steps back from it.
        !banco.recibiendoHoy && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm leading-snug font-semibold tracking-tight text-balance">
          {banco.nombre}
        </h3>
        <Estado banco={banco} seleccion={seleccion} recibeElTuyo={recibeElTuyo} />
      </div>

      <p className="text-muted-foreground mt-1 truncate text-xs">
        {[banco.localidad, banco.direccion].filter(Boolean).join(" · ")}
      </p>

      <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        {/* Comes straight from the sheet and answers the question that follows
            "can they take me" — until what time. */}
        {banco.horarioOficial ? <span className="tabular-nums">{banco.horarioOficial}</span> : null}

        {banco.horarioOficial && banco.linkMaps ? <span aria-hidden>·</span> : null}

        {/*
          The sheet already carries a Maps link per bank, and a Maps listing shows
          the venue's own phone. That covers what a donor needs when a point has
          not listed its types — how to get there, and how to ask — without the
          sheet growing a column someone has to keep current.
        */}
        {banco.linkMaps ? (
          <a
            className="text-foreground font-medium underline underline-offset-2"
            href={banco.linkMaps}
            target="_blank"
            rel="noreferrer"
          >
            Cómo llegar
          </a>
        ) : null}
      </div>
    </li>
  );
}

function Estado({
  banco,
  seleccion,
  recibeElTuyo,
}: {
  banco: BancoSangreVista;
  seleccion: SeleccionTipo;
  recibeElTuyo: boolean;
}) {
  // Sits to the right of the name, so it has to hold its width and stay on one
  // line: the column of chips down the right edge is what makes the list
  // scannable without reading a single bank name.
  const base =
    "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide whitespace-nowrap uppercase";

  if (!banco.recibiendoHoy) {
    return (
      <span className={cn(base, "bg-muted text-muted-foreground")} title="Hoy no está recibiendo">
        <span aria-hidden>●</span> Hoy no
      </span>
    );
  }

  // Receiving, but nobody said which types. Different from "not receiving": the
  // donor can still go, they just cannot know in advance whether they match.
  if (banco.tiposQueRecibe.length === 0) {
    return (
      <span
        className={cn(base, "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300")}
        title="Este punto no ha dicho qué tipos recibe. Puede que reciba el tuyo — confirma antes de desplazarte."
      >
        <span aria-hidden>●</span> Sin confirmar
      </span>
    );
  }

  if (recibeElTuyo) {
    return (
      <span
        className={cn(
          base,
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
        )}
      >
        <span aria-hidden>●</span> Recibe {seleccion?.replace("-", "−")}
      </span>
    );
  }

  // The coordinator's own wording — "O+, RH−" reads better than the five types it
  // expands into, and it is what the person at the door will also say.
  const resumen = banco.resumenTipos ?? banco.tiposQueRecibe.join(", ");

  return (
    <span
      className={cn(base, "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300")}
      title={`Hoy solo ${resumen}`}
    >
      <span aria-hidden>●</span> {resumen.replace(/-/g, "−")}
    </span>
  );
}
