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
  /** What is on the other side, so the button never promises more than it gives. */
  queEncuentras: string;
  direccion: string;
  horario: string[];
  telefono?: { texto: string; marcar: string };
  /** Surfaced as a chip when a bank has something the other does not. */
  destacado?: string;
  /** Top edge, so the two are told apart before either is read. */
  acento: string;
};

/**
 * Why bother, in three numbers, quoted from the IDCBIS page.
 *
 * The screen was answering "where do I go" without ever answering "why would
 * I". The half hour is the one that changes minds: the objection to donating is
 * almost never the needle, it is not knowing whether this costs an afternoon.
 */
const RAZONES: Array<{ dato: string; texto: string }> = [
  { dato: "1", texto: "donación" },
  { dato: "3", texto: "adultos o 4 niños" },
  { dato: "30", texto: "minutos" },
];

/**
 * The two places in Bogotá that take blood donations directly.
 *
 * Ordered by what a donor does, not alphabetically: the Cruz Roja books an
 * appointment online, and the Banco Distrital is the one you can walk into on a
 * Saturday. Those are the two different situations someone arrives with.
 *
 * Every line is taken from the organisations' own pages, and each card says
 * what is on the other side of its button. That matters more here than
 * anywhere: the two links do different things, and a label that oversells one
 * sends someone to a place expecting something it does not offer.
 *
 * What is deliberately absent is the requirements list. The pages disagree on
 * the minimum weight, and a donor who reads a number that turns out to be wrong
 * for them either travels for nothing or — worse — decides not to go at all.
 */
const BANCOS: Banco[] = [
  {
    nombre: "Cruz Roja Colombiana",
    quienes: "Banco de sangre de la Cruz Roja, sede nacional en Bogotá.",
    url: "https://www.cruzrojacolombiana.org/dona-sangre/",
    // Not "agenda tu cita": the page is a form — name, id, blood group,
    // availability — and the Cruz Roja contacts you afterwards. Calling it an
    // appointment promised a confirmation the page does not give, and a donor
    // who turns up expecting one gets turned away.
    accion: "Regístrate como donante",
    queEncuentras: "Formulario para dejar tus datos y tu disponibilidad. Ellos te contactan.",
    direccion: "Av. Cra. 68 #68B-31",
    horario: [],
    telefono: { texto: "601 794 6566", marcar: "+576017946566" },
    acento: "border-t-rose-500",
  },
  {
    nombre: "Banco Distrital de Sangre",
    quienes: "El banco público del Distrito, operado por el IDCBIS.",
    url: "https://idcbis.org.co/banco-distrital-de-sangre/",
    // Their own headings: "Conoce los puntos de donación de sangre aquí" and
    // "Requisitos para donar".
    accion: "Ver puntos y requisitos",
    queEncuentras: "Puntos de donación, requisitos y tipos de donación.",
    direccion: "Cra. 32 #12-81, Edificio IDCBIS",
    horario: ["Lun a vie · 8:00 a.m. – 4:30 p.m.", "Sáb y dom · 7:00 a.m. – 12:00 m."],
    // The one thing that decides it for most people: it is the only one of the
    // two that publishes weekend hours, and a weekday-only option is no option
    // at all for someone who works.
    destacado: "Abre fines de semana",
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

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
        {RAZONES.map(({ dato, texto }) => (
          <p key={texto} className="flex items-baseline gap-1.5">
            <span className="font-heading text-2xl font-bold text-rose-600 tabular-nums dark:text-rose-400">
              {dato}
            </span>
            <span className="text-muted-foreground text-sm">{texto}</span>
          </p>
        ))}
        <p className="text-muted-foreground/70 basis-full text-xs">
          Según el Banco Distrital de Sangre.
        </p>
      </div>

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
      <div className="bg-muted/40 space-y-2 rounded-xl border p-4">
        <p className="text-foreground text-sm font-medium">Antes de ir</p>
        <ul className="text-muted-foreground space-y-1 text-sm">
          <li className="flex gap-2 text-pretty">
            <span className="text-foreground/40" aria-hidden>
              —
            </span>
            Lleva tu documento de identidad.
          </li>
          <li className="flex gap-2 text-pretty">
            <span className="text-foreground/40" aria-hidden>
              —
            </span>
            Come algo al menos 4 horas antes. Ir en ayunas es la razón más común por la que
            devuelven a alguien.
          </li>
          <li className="flex gap-2 text-pretty">
            <span className="text-foreground/40" aria-hidden>
              —
            </span>
            Cada banco tiene requisitos adicionales — están en su página.
          </li>
        </ul>
      </div>
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
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="leading-snug font-semibold tracking-tight text-balance">{banco.nombre}</h2>
          {banco.destacado ? (
            <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {banco.destacado}
            </span>
          ) : null}
        </div>
        <p className="text-muted-foreground mt-1 text-xs text-pretty">{banco.quienes}</p>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className="text-foreground text-sm text-pretty">{banco.queEncuentras}</p>

        <div className="space-y-1.5">
          <p className="text-muted-foreground flex items-start gap-2 text-sm">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>{banco.direccion}</span>
          </p>

          {/* Only where the organisation publishes them. The Cruz Roja page
              states no opening hours, and inventing a range for a place someone
              may travel to is not a gap worth filling. */}
          {banco.horario.length > 0 ? (
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
          ) : null}

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
