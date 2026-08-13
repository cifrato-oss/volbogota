import Link from "next/link";

import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-foreground/10 border-t">
      <div className="text-foreground/60 mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span>
          © {new Date().getFullYear()} {siteConfig.name}
        </span>
        <Link href="/tratamiento-datos" className="hover:text-foreground transition-colors">
          Tratamiento de datos personales
        </Link>
      </div>
    </footer>
  );
}
