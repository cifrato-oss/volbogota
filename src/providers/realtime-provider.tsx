"use client";

import { useQueryClient } from "@tanstack/react-query";
import { collection, onSnapshot } from "firebase/firestore";
import { useEffect, type ReactNode } from "react";

import { getFirebaseDb } from "@/lib/firebase-client";
import { queryKeys } from "@/queries/queryKeys";

/**
 * Public collections whose React Query caches we refresh on any change.
 *
 * `centros` and `necesidades` are NOT here: both are read straight from
 * Firestore via `onSnapshot` (`useCentrosRealtime`/`useCentroRealtime` and
 * `useNecesidadesRealtime`), so there is no query cache to invalidate for them.
 * `turnos` still goes through the API, so it stays.
 */
const SUBSCRIPCIONES = [{ coleccion: "turnos", queryKey: queryKeys.turnos.all }] as const;

/** Coalesce bursts of writes (e.g. many bookings) into one refetch. */
const DEBOUNCE_MS = 400;

/**
 * Subscribes to Firestore in the browser and invalidates React Query on any
 * change, so shift occupancy (cupos) refreshes in real time. The API stays the
 * source of truth — snapshots only signal "refetch" — so no server logic is
 * duplicated. Degrades to polling when the client SDK isn't configured.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) return;

    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    const unsubscribes = SUBSCRIPCIONES.map(({ coleccion, queryKey }) =>
      onSnapshot(
        collection(db, coleccion),
        () => {
          clearTimeout(timers.get(coleccion));
          timers.set(
            coleccion,
            setTimeout(() => queryClient.invalidateQueries({ queryKey }), DEBOUNCE_MS),
          );
        },
        (error) => {
          if (process.env.NODE_ENV !== "production") {
            console.warn(`Realtime "${coleccion}" desconectado:`, error.message);
          }
        },
      ),
    );

    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [queryClient]);

  return children;
}
