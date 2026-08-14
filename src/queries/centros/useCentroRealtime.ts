"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";

import { getFirebaseDb } from "@/lib/firebase-client";
import type { Centro } from "@/types/volbogota";

import { mapCentro } from "./mapCentro";

type Estado = {
  data: Centro | null;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
};

const INICIAL: Estado = { data: null, isPending: true, isError: false, error: null };

/**
 * A single collection center by id, read live from Firestore.
 *
 * Powers both the volunteer detail (`/centros/[id]`) and the donation detail
 * (`/donar/[id]`): it subscribes to just that one doc and re-renders on any
 * edit. Inactive centers are still returned (the detail views decide what to do
 * with `activo`); a missing doc surfaces as an error, like the old 404. Disabled
 * until an id is provided.
 */
export default function useCentroRealtime(id: string | undefined) {
  const [estado, setEstado] = useState<Estado>(INICIAL);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => {
    setEstado(INICIAL);
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db || !id) {
      // Nothing to subscribe to; report it without a synchronous setState.
      const timer = setTimeout(
        () =>
          setEstado({
            data: null,
            isPending: false,
            isError: Boolean(id),
            error: id ? new Error("Firestore no está disponible en el cliente.") : null,
          }),
        0,
      );
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    const unsubscribe = onSnapshot(
      doc(db, "centros", id),
      (snapshot) => {
        if (cancelled) return;
        if (!snapshot.exists()) {
          setEstado({
            data: null,
            isPending: false,
            isError: true,
            error: new Error("El centro de acopio no existe."),
          });
          return;
        }
        setEstado({
          data: mapCentro(snapshot.id, snapshot.data() ?? {}),
          isPending: false,
          isError: false,
          error: null,
        });
      },
      (error) => {
        if (cancelled) return;
        if (process.env.NODE_ENV !== "production") {
          console.warn("centro onSnapshot:", error.message);
        }
        setEstado({ data: null, isPending: false, isError: true, error });
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [id, nonce]);

  return { ...estado, refetch };
}
