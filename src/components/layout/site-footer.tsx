import Link from "next/link";

import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-foreground/10 border-t">
      <div className="text-foreground/60 mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span>
          © {new Date().getFullYear()} {siteConfig.name}
        </span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Link href="/tratamiento-datos" className="hover:text-foreground transition-colors">
            Tratamiento de datos personales
          </Link>

          {/*
            A pill rather than one more line of fine print. A coordinator reads
            this on a phone at a centre's door, and next to the data-treatment
            link it disappeared — same size, same colour, same weight.

            It borrows the header badge's shape so it does not read as a new
            visual idea, but stays outlined instead of filled: the header pill
            announces the event to every visitor, and this one is a door for six
            people. Louder than the fine print, quieter than the volunteer CTA.

            Linking it costs nothing. `/admin` is a guessable path, and what
            protects volunteers' data is the session, not where the door is.
          */}
          <Link
            href="/admin"
            className="border-foreground/15 hover:border-primary/40 hover:text-primary hover:bg-primary/5 inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 font-medium transition-colors"
          >
            <span aria-hidden>🔑</span>
            Coordinadores
          </Link>
        </div>
      </div>
    </footer>
  );
}
