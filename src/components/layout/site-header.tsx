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
      </div>
    </header>
  );
}
