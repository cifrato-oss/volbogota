import type { Metadata } from "next";

import { DirectorioSangre } from "@/components/sangre/directorio-sangre";
import { DonarSangre } from "@/components/sangre/donar-sangre";
import { listaDeBancosHabilitada } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Quiero donar sangre",
  description:
    "Los dos bancos de sangre que reciben donantes en Bogotá: la Cruz Roja Colombiana y el Banco Distrital de Sangre del IDCBIS.",
};

/**
 * Two screens, one route.
 *
 * The directory is what a donor gets: two organisations, each maintaining its
 * own hours and requirements on its own site. The live per-bank list is behind
 * `NEXT_PUBLIC_SANGRE_BANCOS` — see `listaDeBancosHabilitada` for why it stayed.
 */
export default function SangrePage() {
  return listaDeBancosHabilitada ? <DonarSangre /> : <DirectorioSangre />;
}
