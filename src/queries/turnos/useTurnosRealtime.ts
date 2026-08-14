"use client";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";

import { getFirebaseDb } from "@/lib/firebase-client";
import type { Turno } from "@/types/volbogota";

import { mapTurno } from "./mapTurno";

type Estado = {
  data: Turno[];
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

const INICIAL: Estado = { data: [], isPending: true, isError: false, error: null };

/**
 * A center's shifts, read live from the Firestore `turnos` collection.
 *
 * Subscribes to just this center's shifts (`where centroId ==`) and re-renders
 * the instant occupancy changes — so a cupo taken by someone else drops here
 * without a poll or refetch. Ordering (fecha → jornada) is done in memory to
 * avoid a composite index, mirroring the API. Returns a React-Query-like shape
 * so the selector stays the same.
 */
export default function useTurnosRealtime(centroId: string | undefined) {
  const [estado, setEstado] = useState<Estado>(INICIAL);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => {
    setEstado(INICIAL);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db || !centroId) {
      // Nothing to subscribe to; report it without a synchronous setState.
      const timer = setTimeout(
        () =>
          setEstado({
            data: [],
            isPending: false,
            isError: Boolean(centroId),
            error: centroId ? new Error("Firestore no está disponible en el cliente.") : null,
          }),
        0,
      );
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    const turnosDelCentro = query(collection(db, "turnos"), where("centroId", "==", centroId));

    const unsubscribe = onSnapshot(
      turnosDelCentro,
      (snapshot) => {
        if (cancelled) return;
        const turnos = snapshot.docs
          .map((doc) => mapTurno(doc.id, doc.data()))
          .sort(
            (a, b) =>
              a.fecha.localeCompare(b.fecha) ||
              a.horario.inicio.localeCompare(b.horario.inicio) ||
              a.jornada.localeCompare(b.jornada, "es"),
          );
        setEstado({ data: turnos, isPending: false, isError: false, error: null });
      },
      (error) => {
        if (cancelled) return;
        if (process.env.NODE_ENV !== "production") {
          console.warn("turnos onSnapshot:", error.message);
        }
        setEstado({ data: [], isPending: false, isError: true, error });
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [centroId, nonce]);

  return { ...estado, refetch };
}
