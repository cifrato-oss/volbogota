import type { Jornada } from "@/types/volbogota";

/** Canonical shift order used everywhere shifts are listed: AM → PM → NOCHE. */
export const JORNADA_ORDER: readonly Jornada[] = ["AM", "PM", "NOCHE"] as const;

/**
 * Shifts offered to volunteers: only morning and night — no afternoon.
 * ("Solo necesitamos dos turnos: Mañana y Noche. No se necesita turno de tarde.")
 */
export const JORNADAS_VOLUNTARIADO: readonly Jornada[] = ["AM", "NOCHE"] as const;

/** Human-readable label for each shift period (Colombian Spanish). */
export const JORNADA_LABEL: Record<Jornada, string> = {
  AM: "Mañana",
  PM: "Tarde",
  NOCHE: "Noche",
};

type JornadaStyle = {
  emoji: string;
  /** Colored top accent for the shift column. */
  topBorder: string;
  /** Ring color when a shift in this column is selected. */
  ring: string;
  /** Tint for the selected date row. */
  selectedRow: string;
};

/** Per-shift visual identity for the selector cards. */
export const JORNADA_STYLE: Record<Jornada, JornadaStyle> = {
  AM: {
    emoji: "☀️",
    topBorder: "border-t-amber-400",
    ring: "ring-amber-400",
    selectedRow: "border-amber-400 bg-amber-50 dark:bg-amber-950/30",
  },
  PM: {
    emoji: "🌤️",
    topBorder: "border-t-rose-400",
    ring: "ring-rose-400",
    selectedRow: "border-rose-400 bg-rose-50 dark:bg-rose-950/30",
  },
  NOCHE: {
    emoji: "🌙",
    topBorder: "border-t-indigo-500",
    ring: "ring-indigo-500",
    selectedRow: "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30",
  },
};
