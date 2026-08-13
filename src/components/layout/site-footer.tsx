import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-foreground/10 border-t">
      <div className="text-foreground/60 mx-auto max-w-5xl px-4 py-6 text-sm">
        © {new Date().getFullYear()} {siteConfig.name}
      </div>
    </footer>
  );
}
