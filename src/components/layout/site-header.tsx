import Link from "next/link";

import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="bg-blue-800 text-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label={`${siteConfig.name} · Inicio`}
        >
          <span className="text-3xl" aria-hidden>
            🤝
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-bold tracking-tight">{siteConfig.name}</span>
            <span className="block text-xs text-blue-100">Centros de Acopio Oficiales</span>
          </span>
        </Link>

        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-yellow-400 px-3 py-1.5 text-sm font-semibold text-blue-900">
          <span aria-hidden>📅</span>
          {siteConfig.eventLabel}
        </span>
      </div>
    </header>
  );
}
