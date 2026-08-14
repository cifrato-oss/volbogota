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

      <section className="bg-card space-y-4 rounded-2xl border p-5">
        <div className="space-y-1">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-widest uppercase">
            Autoevaluación
          </p>
          <h2 className="font-heading text-lg font-semibold">¿Sabes tu tipo de sangre?</h2>
          <p className="text-muted-foreground text-sm text-pretty">
            Si no lo sabes, igual puedes donar: te lo dicen ahí.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                  "rounded-xl border px-3 py-3 text-base font-semibold transition-colors",
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
            "w-full rounded-xl border px-3 py-3 text-sm font-medium transition-colors",
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
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : visibles.length === 0 ? (
          <p className="text-muted-foreground bg-muted/40 rounded-2xl border p-5 text-sm text-pretty">
            Ningún punto está recibiendo tu tipo hoy. Eso no significa que no puedan recibirte:
            llama al punto antes de desplazarte.
          </p>
        ) : (
          <ul className="space-y-3">
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
        "bg-card space-y-2 rounded-2xl border p-4",
        recibeElTuyo && "border-rose-500 ring-1 ring-rose-500/20",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="font-semibold tracking-tight">{banco.nombre}</h3>
      </div>

      <p className="text-muted-foreground text-sm">
        {[banco.direccion, banco.localidad].filter(Boolean).join(" · ")}
      </p>

      <Estado banco={banco} seleccion={seleccion} recibeElTuyo={recibeElTuyo} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {/* Comes straight from the sheet and answers the question that follows
            "can they take me" — until what time. */}
        {banco.horarioOficial ? (
          <p className="text-muted-foreground text-xs tabular-nums">{banco.horarioOficial}</p>
        ) : null}

        {/*
          The sheet already carries a Maps link per bank, and a Maps listing shows
          the venue's own phone. That covers what a donor needs when a point has
          not listed its types — how to get there, and how to ask — without the
          sheet growing a column someone has to keep current.
        */}
        {banco.linkMaps ? (
          <a
            className="text-foreground text-xs font-medium underline underline-offset-2"
            href={banco.linkMaps}
            target="_blank"
            rel="noreferrer"
          >
            Ver en Maps
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
  const base =
    "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold tracking-wide uppercase";

  if (!banco.recibiendoHoy) {
    return (
      <span className={cn(base, "bg-muted text-muted-foreground")}>
        <span aria-hidden>●</span> Hoy no está recibiendo
      </span>
    );
  }

  // Receiving, but nobody said which types. Different from "not receiving": the
  // donor can still go, they just cannot know in advance whether they match.
  if (banco.tiposQueRecibe.length === 0) {
    return (
      <div className="space-y-1.5">
        <span
          className={cn(
            base,
            "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
          )}
        >
          <span aria-hidden>●</span> Recibiendo · tipos sin confirmar
        </span>
        <p className="text-muted-foreground text-xs text-pretty">
          Este punto no ha dicho qué tipos está recibiendo. Puede que reciba el tuyo — confirma
          antes de desplazarte.
        </p>
      </div>
    );
  }

  // The coordinator's own wording — "O+, RH−" reads better than the five types it
  // expands into, and it is what the person at the door will also say.
  const resumen = banco.resumenTipos ?? banco.tiposQueRecibe.join(", ");

  if (recibeElTuyo) {
    return (
      <span
        className={cn(
          base,
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
        )}
      >
        <span aria-hidden>●</span> Recibe {seleccion?.replace("-", "−")} hoy
      </span>
    );
  }

  return (
    <span className={cn(base, "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300")}>
      <span aria-hidden>●</span> Hoy solo {resumen.replace(/-/g, "−")}
    </span>
  );
}
