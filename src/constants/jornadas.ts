import type { Jornada } from "@/types/volbogota";

/** Canonical shift order used everywhere shifts are listed: Mañana → Noche. */
export const JORNADA_ORDER: readonly Jornada[] = ["MANANA", "NOCHE"] as const;

/** Human-readable label for each shift period (Colombian Spanish). */
export const JORNADA_LABEL: Record<Jornada, string> = {
  MANANA: "Mañana",
  NOCHE: "Noche",
};
