import type { Metadata } from "next";

import { PanelAdmin } from "@/components/admin/panel-admin";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = {
  title: "Panel de coordinación",
  // The panel lists volunteers' names and phone numbers. Keeping it out of
  // search results costs nothing and the session is not the only thing that
  // should stand between that data and a crawler.
  robots: { index: false, follow: false },
};

/**
 * Outside the `(web)` group on purpose: the public shell's header and footer are
 * for volunteers, and the panel is read on a phone at a collection point's door.
 *
 * Dropping that shell also dropped the only way back to the site, so the way out
 * is rebuilt here — above the panel, so it is there both on the login screen and
 * once inside. Someone who opens `/admin` by mistake, or who is done for the day,
 * should not have to reach for the browser's back button.
 */
export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-4">
        <BackButton href="/">Volver al sitio</BackButton>
      </div>

      <PanelAdmin />
    </main>
  );
}
