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

/** Look of one shift column in the volunteer selector, keyed by position. */
export type EstiloJornada = {
  emoji: string;
  topBorder: string;
  ring: string;
  selectedRow: string;
  /** Color for this column's (visible) scrollbar thumb — a CSS var reference. */
  scrollThumb: string;
};

// One accent per column; cycles when a center has more jornadas than colors.
// The class strings are literal so Tailwind emits them (and the matching
// `--color-*` vars the scrollbar references).
const PALETA_JORNADAS: readonly Omit<EstiloJornada, "emoji">[] = [
  {
    topBorder: "border-t-amber-400",
    ring: "ring-amber-400",
    selectedRow: "border-amber-400 bg-amber-50 dark:bg-amber-950/30",
    scrollThumb: "var(--color-amber-400)",
  },
  {
    topBorder: "border-t-rose-400",
    ring: "ring-rose-400",
    selectedRow: "border-rose-400 bg-rose-50 dark:bg-rose-950/30",
    scrollThumb: "var(--color-rose-400)",
  },
  {
    topBorder: "border-t-sky-400",
    ring: "ring-sky-400",
    selectedRow: "border-sky-400 bg-sky-50 dark:bg-sky-950/30",
    scrollThumb: "var(--color-sky-400)",
  },
  {
    topBorder: "border-t-violet-400",
    ring: "ring-violet-400",
    selectedRow: "border-violet-400 bg-violet-50 dark:bg-violet-950/30",
    scrollThumb: "var(--color-violet-400)",
  },
  {
    topBorder: "border-t-emerald-400",
    ring: "ring-emerald-400",
    selectedRow: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
    scrollThumb: "var(--color-emerald-400)",
  },
  {
    topBorder: "border-t-fuchsia-400",
    ring: "ring-fuchsia-400",
    selectedRow: "border-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-950/30",
    scrollThumb: "var(--color-fuchsia-400)",
  },
];

/** Emoji inferred from the jornada name; a calendar when it's unfamiliar. */
function emojiJornada(jornada: string): string {
  const j = jornada.toLowerCase();
  if (j.includes("noche")) return "🌙";
  if (j === "am" || j.includes("mañan") || j.includes("manan")) return "☀️";
  if (j === "pm" || j.includes("tarde")) return "🌤️";
  return "🗓️";
}

/** Resolves a column's look from its jornada name and position in the grid. */
export function resolverEstiloJornada(jornada: string, indice: number): EstiloJornada {
  const base = PALETA_JORNADAS[indice % PALETA_JORNADAS.length]!;
  return { emoji: emojiJornada(jornada), ...base };
}
