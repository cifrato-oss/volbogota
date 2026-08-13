import type { Jornada } from "@/types/volbogota";

/** Canonical shift order used everywhere shifts are listed: AM → PM. */
export const JORNADA_ORDER: readonly Jornada[] = ["AM", "PM"] as const;

/** The domain only has these two shifts, so this is just `JORNADA_ORDER`
 * under the name the volunteer flow reaches for. */
export const JORNADAS_VOLUNTARIADO: readonly Jornada[] = JORNADA_ORDER;

/** Human-readable label for each shift period. */
export const JORNADA_LABEL: Record<Jornada, string> = {
  AM: "AM",
  PM: "PM",
};

/** Fixed schedule per shift, taken from the spreadsheet. */
export const JORNADA_HORARIO: Record<Jornada, string> = {
  AM: "8:00 a.m. - 2:00 p.m.",
  PM: "1:00 p.m. - 5:00 p.m.",
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
};
