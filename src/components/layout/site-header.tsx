"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname() ?? "";

  return (
    <header className="border-primary/10 sticky top-0 z-40 border-b bg-[color-mix(in_oklab,var(--primary)_6%,var(--background))]">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:py-4">
        <Link
          href="/"
          className="flex items-center justify-center gap-3 sm:justify-start"
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
          <span className="min-w-0 leading-tight">
            <span className="font-heading block text-base font-bold tracking-tight sm:text-lg">
              {siteConfig.name}
            </span>
            <span className="text-muted-foreground hidden text-xs sm:block">
              Centros de Acopio Oficiales
            </span>
          </span>
        </Link>

        <nav aria-label="Navegación principal">
          <ul className="flex items-center justify-center gap-0.5 sm:justify-end sm:gap-1">
            {siteConfig.nav.map((item) => {
              const activo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={activo ? "page" : undefined}
                    className={cn(
                      "block rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                      activo
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-primary/5 hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
