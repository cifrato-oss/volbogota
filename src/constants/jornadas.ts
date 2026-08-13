import type { Jornada } from "@/types/volbogota";

/** Canonical shift order used everywhere shifts are listed: AM → PM → NOCHE. */
export const JORNADA_ORDER: readonly Jornada[] = ["AM", "PM", "NOCHE"] as const;

/** Human-readable label for each shift period (Colombian Spanish). */
export const JORNADA_LABEL: Record<Jornada, string> = {
  AM: "Mañana",
  PM: "Tarde",
  NOCHE: "Noche",
};
