import Image from "next/image";
import Link from "next/link";

import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="border-primary/10 bg-primary/5 border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label={`${siteConfig.name} · Inicio`}
        >
          {/* Logos oficiales unidos: Alcaldía de Bogotá + Cruz Roja. */}
          <span className="flex shrink-0 items-center gap-2.5">
            <Image
              src="/bogota_logo.webp"
              alt="Alcaldía Mayor de Bogotá"
              width={3840}
              height={1959}
              priority
              className="h-7 w-auto sm:h-8"
            />
            <span aria-hidden className="bg-primary/25 h-7 w-px sm:h-8" />
            <Image
              src="/cruz-roja.png"
              alt="Cruz Roja"
              width={512}
              height={512}
              priority
              className="h-7 w-auto sm:h-8"
            />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="font-heading block text-lg font-bold tracking-tight">
              {siteConfig.name}
            </span>
            <span className="text-muted-foreground block text-xs">Centros de Acopio Oficiales</span>
          </span>
        </Link>

        <span className="bg-primary/10 text-primary inline-flex w-fit shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-sm">
          <span aria-hidden>📅</span>
          <span className="sm:hidden">{siteConfig.eventLabel}</span>
          <span className="hidden sm:inline">{siteConfig.eventLabelLong}</span>
        </span>
      </div>
    </header>
  );
}
