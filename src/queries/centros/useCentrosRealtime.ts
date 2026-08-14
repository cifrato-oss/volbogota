"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";

import { getFirebaseDb } from "@/lib/firebase-client";
import type { Centro } from "@/types/volbogota";

import { mapCentro } from "./mapCentro";

type Estado = {
  data: Centro[];
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

const INICIAL: Estado = { data: [], isPending: true, isError: false, error: null };

/**
 * All active collection centers, read live from Firestore.
 *
 * Subscribes to the whole `centros` collection (six docs, public read) and
 * re-renders the instant a coordinator toggles `activo`, edits cupos, or a new
 * point is imported — no API round trip, no polling. The list mirrors the API's
 * shaping: only active centers, sorted by name. Returns a React-Query-like shape
 * (`isPending`/`isError`/`error`/`refetch`) so callers stay the same.
 */
export default function useCentrosRealtime() {
  const [estado, setEstado] = useState<Estado>(INICIAL);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => {
    setEstado(INICIAL);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) {
      // No client Firestore (server, or missing public config): report it
      // without a synchronous setState during the effect.
      const timer = setTimeout(
        () =>
          setEstado({
            data: [],
            isPending: false,
            isError: true,
            error: new Error("Firestore no está disponible en el cliente."),
          }),
        0,
      );
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    const unsubscribe = onSnapshot(
      collection(db, "centros"),
      (snapshot) => {
        if (cancelled) return;
        const centros = snapshot.docs
          .map((doc) => mapCentro(doc.id, doc.data()))
          .filter((centro) => centro.activo)
          .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
        setEstado({ data: centros, isPending: false, isError: false, error: null });
      },
      (error) => {
        if (cancelled) return;
        if (process.env.NODE_ENV !== "production") {
          console.warn("centros onSnapshot:", error.message);
        }
        setEstado({ data: [], isPending: false, isError: true, error });
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [nonce]);

  return { ...estado, refetch };
}
