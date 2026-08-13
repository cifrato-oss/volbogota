import type { Jornada } from "@/types/volbogota";

/** Canonical shift order used everywhere shifts are listed: Mañana → Noche. */
export const JORNADA_ORDER: readonly Jornada[] = ["MANANA", "NOCHE"] as const;

/**
 * Shifts offered to volunteers. The domain only has these two — no afternoon —
 * so this is just `JORNADA_ORDER` under the name the volunteer flow reaches for.
 * ("Solo necesitamos dos turnos: Mañana y Noche. No se necesita turno de tarde.")
 */
export const JORNADAS_VOLUNTARIADO: readonly Jornada[] = JORNADA_ORDER;

/** Human-readable label for each shift period (Colombian Spanish). */
export const JORNADA_LABEL: Record<Jornada, string> = {
  MANANA: "Mañana",
  NOCHE: "Noche",
};

/**
 * Fallback description of each shift's rule (morning: opening → noon; night:
 * 1 p.m. → closing), for when a centre's real computed schedule
 * (`turno.horario.etiqueta`) is not at hand yet.
 */
export const JORNADA_HORARIO: Record<Jornada, string> = {
  MANANA: "Desde la apertura del centro hasta el mediodía",
  NOCHE: "Desde la 1:00 p.m. hasta el cierre del centro",
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
  MANANA: {
    emoji: "☀️",
    topBorder: "border-t-amber-400",
    ring: "ring-amber-400",
    selectedRow: "border-amber-400 bg-amber-50 dark:bg-amber-950/30",
  },
  NOCHE: {
    emoji: "🌙",
    topBorder: "border-t-indigo-400",
    ring: "ring-indigo-400",
    selectedRow: "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30",
  },
};
