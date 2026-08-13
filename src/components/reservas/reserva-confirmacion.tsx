"use client";

import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { formatFecha } from "@/lib/format-fecha";
import type { Reserva } from "@/types/volbogota";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

/** Success screen shown after a booking is confirmed. */
export function ReservaConfirmacion({ reserva }: { reserva: Reserva }) {
  const { turno } = reserva;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The form just unmounted, so move focus here and scroll into view — otherwise
  // the success (and the confirmation code) is silent for screen readers and
  // off-screen on mobile after submitting from the bottom of the form.
  useEffect(() => {
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-primary/30 bg-primary/5 space-y-5 rounded-xl border p-6 text-center"
    >
      <CheckCircle2 className="text-primary mx-auto size-10" aria-hidden />

      <div className="space-y-1">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="text-xl font-semibold tracking-tight outline-none"
        >
          ¡Reserva confirmada!
        </h2>
        <p className="text-muted-foreground text-sm">
          Guarda tu código de confirmación y preséntalo en el centro.
        </p>
      </div>

      <div className="bg-background mx-auto w-fit rounded-lg border px-4 py-2 font-mono text-lg font-semibold tracking-widest">
        {reserva.codigo}
      </div>

      <dl className="mx-auto grid max-w-sm gap-1.5 text-left text-sm">
        <Row label="Voluntario" value={reserva.nombre} />
        <Row label="Centro" value={turno.centroNombre} />
        <Row
          label="Fecha"
          value={formatFecha(turno.fecha, { weekday: "long", day: "numeric", month: "long" })}
        />
        <Row label="Jornada" value={`${turno.jornada} · ${turno.horario}`} />
        {turno.direccion ? <Row label="Dirección" value={turno.direccion} /> : null}
      </dl>

      <Button variant="outline" render={<Link href="/" />}>
        Volver al inicio
      </Button>
    </div>
  );
}
