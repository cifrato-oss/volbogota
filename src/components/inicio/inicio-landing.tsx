import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

type Opcion = {
  href: string;
  emoji: string;
  titulo: string;
  cta: string;
  accent: string;
};

const OPCIONES: Opcion[] = [
  {
    href: "/donar",
    emoji: "📦",
    titulo: "Quiero donar",
    cta: "Ver centros y necesidades",
    accent: "border-t-sky-400 hover:border-sky-300",
  },
  {
    href: "/voluntario",
    emoji: "🤝",
    titulo: "Quiero ser voluntario",
    cta: "Elegir centro y jornada",
    accent: "border-t-primary hover:border-primary/40",
  },
];

/** Entry screen: split the flow into donating vs. volunteering. */
export function InicioLanding() {
  return (
    <div className="flex min-h-[70vh] flex-col justify-center gap-10 py-8">
      <header className="mx-auto max-w-2xl space-y-4 text-center">
        <h1 className="font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          {siteConfig.name}
        </h1>
        <p className="text-muted-foreground text-lg text-pretty">{siteConfig.description}</p>
      </header>

      <div className="mx-auto grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        {OPCIONES.map((opcion) => (
          <Link
            key={opcion.href}
            href={opcion.href}
            className={cn(
              "group bg-card flex flex-col gap-4 rounded-2xl border border-t-4 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
              opcion.accent,
            )}
          >
            <span className="text-4xl" aria-hidden>
              {opcion.emoji}
            </span>
            <h2 className="text-xl font-semibold tracking-tight">{opcion.titulo}</h2>
            <span className="text-foreground mt-auto inline-flex items-center gap-1 text-sm font-medium">
              {opcion.cta}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </Link>
        ))}
      </div>

      <p className="text-muted-foreground mx-auto max-w-xl text-center text-xs text-pretty">
        ¿No sabes por dónde empezar? Si tienes cosas para entregar, elige “Quiero donar”. Si quieres
        ayudar en persona en un centro, elige “Quiero ser voluntario”.
      </p>
    </div>
  );
}
