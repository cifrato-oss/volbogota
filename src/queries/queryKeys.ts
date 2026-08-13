import type { TurnosQuery } from "@/types/volbogota";

/**
 * Central registry of TanStack Query keys.
 *
 * Keeping them here keeps cache reads, prefetches, and invalidations
 * consistent across hooks. Each key is `as const` so it types as a tuple.
 */
export const queryKeys = {
  catalogos: ["catalogos"] as const,
  centros: {
    all: ["centros"] as const,
    detail: (id: string) => ["centros", "detail", id] as const,
  },
  turnos: {
    all: ["turnos"] as const,
    list: (query: TurnosQuery = {}) => ["turnos", "list", query] as const,
    detail: (id: string) => ["turnos", "detail", id] as const,
  },
} as const;
