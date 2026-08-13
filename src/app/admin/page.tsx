import type { Metadata } from "next";

import { PanelAdmin } from "@/components/admin/panel-admin";

export const metadata: Metadata = {
  title: "Panel de coordinación",
  // The panel lists volunteers' names and phone numbers. Keeping it out of
  // search results costs nothing and the token is not the only thing that should
  // stand between that data and a crawler.
  robots: { index: false, follow: false },
};

/**
 * Outside the `(web)` group on purpose: the public shell's header and footer are
 * for volunteers, and the panel is read on a phone at a collection point's door.
 */
export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <PanelAdmin />
    </main>
  );
}
