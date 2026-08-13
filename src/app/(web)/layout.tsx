import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * Shell for the public web app. The `(web)` group keeps these routes out of the
 * URL while letting future groups — `(admin)`, `(auth)` — carry their own chrome.
 */
export default function WebLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
      <SiteFooter />
    </div>
  );
}
