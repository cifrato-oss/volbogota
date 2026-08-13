import Link from "next/link";

import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="border-primary/10 bg-primary/5 border-b">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label={`${siteConfig.name} · Inicio`}
        >
          <span className="text-2xl" aria-hidden>
            🤝
          </span>
          <span className="leading-tight">
            <span className="font-heading block text-lg font-bold tracking-tight">
              {siteConfig.name}
            </span>
            <span className="text-muted-foreground block text-xs">Centros de Acopio Oficiales</span>
          </span>
        </Link>

        <span className="bg-primary/10 text-primary inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium">
          <span aria-hidden>📅</span>
          {siteConfig.eventLabelLong}
        </span>
      </div>
    </header>
  );
}
