import { ArrowUpRight, Clock, MapPin, Phone } from "lucide-react";

import { BackButton } from "@/components/shared/back-button";
import { cn } from "@/lib/utils";

type Banco = {
  nombre: string;
  /** Who they are, in one line, for someone who has not heard of them. */
  quienes: string;
  url: string;
  /** What tapping through actually gets you — the reason to pick this one. */
  accion: string;
  direccion: string;
  horario: string[];
  telefono?: { texto: string; marcar: string };
  /** Top edge, so the two are told apart before either is read. */
  acento: string;
};

/**
 * The two places in Bogotá that take blood donations directly.
 *
 * Ordered by what a donor does, not alphabetically: the Cruz Roja books an
 * appointment online, and the Banco Distrital is the one you can walk into on a
 * Saturday. Those are the two different situations someone arrives with.
 *
 * Everything here is quoted from the organisations' own pages. What is
 * deliberately absent is the requirements list: the pages disagree on the
 * minimum weight, and a donor who reads a number that turns out to be wrong for
 * them either travels for nothing or — worse — decides not to go at all.
 */
const BANCOS: Banco[] = [
  {
    nombre: "Cruz Roja Colombiana",
    quienes: "Banco de sangre de la Cruz Roja, sede nacional en Bogotá.",
    url: "https://www.cruzrojacolombiana.org/dona-sangre/",
    accion: "Agenda tu cita en línea",
    direccion: "Av. Cra. 68 #68B-31",
    horario: ["Agenda mañana o tarde según disponibilidad"],
    telefono: { texto: "601 794 6566", marcar: "+576017946566" },
    acento: "border-t-rose-500",
  },
  {
    nombre: "Banco Distrital de Sangre",
    quienes: "El banco público del Distrito, operado por el IDCBIS.",
    url: "https://idcbis.org.co/banco-distrital-de-sangre/",
    accion: "Consulta requisitos y horarios",
    direccion: "Cra. 32 #12-81, Edificio IDCBIS",
    horario: ["Lun a vie · 8:00 a.m. – 4:30 p.m.", "Sáb y dom · 7:00 a.m. – 12:00 m."],
    acento: "border-t-sky-500",
  },
];

/**
 * "Quiero donar sangre" — two doors and nothing between them.
 *
 * The screen this replaced listed every bank with the types each was taking
 * that day, kept live from the spreadsheet. It still exists behind
 * `NEXT_PUBLIC_SANGRE_BANCOS`; what changed is not the code but the answer to
 * "who maintains this". Sending a donor to the organisation's own page means
 * the hours and requirements they read are the ones being kept current by the
 * people who own them.
 */
export function DirectorioSangre() {
  return (
    <div className="space-y-8 pb-8">
      <BackButton href="/">Volver al inicio</BackButton>

      <header className="space-y-2 border-l-2 border-rose-500 pl-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-balance">
          Quiero donar sangre
        </h1>
        <p className="text-muted-foreground text-sm text-pretty">
          En Bogotá hay dos bancos que reciben donantes directamente. Elige uno y agenda con ellos —
          cada uno mantiene sus propios horarios y requisitos.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        {BANCOS.map((banco) => (
          <li key={banco.url}>
            <TarjetaBanco banco={banco} />
          </li>
        ))}
      </ul>

      {/*
        One donor-facing fact worth stating on our side, because both pages bury
        it and it is the reason people get turned away at the door.
      */}
      <p className="text-muted-foreground bg-muted/40 rounded-xl border p-4 text-sm text-pretty">
        <span className="text-foreground font-medium">Antes de ir:</span> lleva tu documento y come
        algo al menos 4 horas antes. Cada banco tiene requisitos adicionales — están en su página.
      </p>
    </div>
  );
}

/**
 * The card is not a link; the button at the bottom is.
 *
 * Two reasons, and the second is not negotiable. A card-wide link puts the whole
 * surface on a one-way trip out of the site, which a stray tap should never do.
 * And this card also carries a phone number — an anchor inside an anchor is
 * invalid HTML, and browsers resolve it by silently closing the outer one, so
 * half the card would stop working in a way nothing reports.
 */
function TarjetaBanco({ banco }: { banco: Banco }) {
  return (
    <div
      className={cn(
        "bg-card border-border flex h-full flex-col overflow-hidden rounded-xl border border-t-4",
        banco.acento,
      )}
    >
      <div className="border-border bg-muted/40 border-b px-5 py-4">
        <h2 className="leading-snug font-semibold tracking-tight text-balance">{banco.nombre}</h2>
        <p className="text-muted-foreground mt-1 text-xs text-pretty">{banco.quienes}</p>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="space-y-1.5">
          <p className="text-muted-foreground flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{banco.direccion}</span>
          </p>

          <div className="text-muted-foreground flex items-start gap-2 text-sm">
            <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {banco.horario.map((linea) => (
                <span key={linea} className="block tabular-nums">
                  {linea}
                </span>
              ))}
            </span>
          </div>

          {banco.telefono ? (
            <p className="text-muted-foreground flex items-start gap-2 text-sm">
              <Phone className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <a
                href={`tel:${banco.telefono.marcar}`}
                className="hover:text-foreground tabular-nums underline underline-offset-2"
              >
                {banco.telefono.texto}
              </a>
            </p>
          ) : null}
        </div>

        <a
          href={banco.url}
          target="_blank"
          rel="noreferrer"
          className="group border-border bg-background hover:border-foreground/30 hover:bg-muted/50 focus-visible:ring-primary/30 mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          {banco.accion}
          <ArrowUpRight
            className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden
          />
          <span className="sr-only">— abre {new URL(banco.url).hostname} en otra pestaña</span>
        </a>
      </div>
    </div>
  );
}
