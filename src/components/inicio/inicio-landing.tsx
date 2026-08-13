import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

type Opcion = {
  href: string;
  emoji: string;
  titulo: string;
  descripcion: string;
  accent: string;
};

const OPCIONES: Opcion[] = [
  {
    href: "/donar",
    emoji: "📦",
    titulo: "Quiero donar",
    descripcion:
      "Consulta qué necesita cada centro de acopio y lleva tu donación al punto correcto.",
    accent: "border-t-sky-400 hover:border-sky-300",
  },
  {
    href: "/voluntario",
    emoji: "🤝",
    titulo: "Quiero ser voluntario",
    descripcion: "Elige un centro y una jornada, y reserva tu cupo para ayudar en persona.",
    accent: "border-t-primary hover:border-primary/40",
  },
];

/** Entry screen: split the flow into donating vs. volunteering. */
export function InicioLanding() {
  return (
    <div className="space-y-10">
      <header className="space-y-3 text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {siteConfig.name}
        </h1>
        <p className="text-muted-foreground mx-auto max-w-2xl text-pretty">
          {siteConfig.description}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {OPCIONES.map((opcion) => (
          <Link
            key={opcion.href}
            href={opcion.href}
            className={cn(
              "group bg-card flex flex-col gap-3 rounded-2xl border border-t-4 p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
              opcion.accent,
            )}
          >
            <span className="text-4xl" aria-hidden>
              {opcion.emoji}
            </span>
            <h2 className="text-xl font-semibold tracking-tight">{opcion.titulo}</h2>
            <p className="text-muted-foreground flex-1 text-sm text-pretty">{opcion.descripcion}</p>
            <span className="text-foreground inline-flex items-center gap-1 text-sm font-medium">
              Continuar
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
