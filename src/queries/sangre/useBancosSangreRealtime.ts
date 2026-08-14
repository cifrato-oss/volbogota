import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";

import { getFirebaseDb } from "@/lib/firebase-client";
import type { BancoSangreVista, TipoSangre } from "@/types/sangre";
import { reportoHoy, TIPOS_SANGRE } from "@/types/sangre";

type Estado = {
  data: BancoSangreVista[] | null;
  isPending: boolean;
  isError: boolean;
};

function mapear(docs: Array<{ id: string; data: Record<string, unknown> }>): BancoSangreVista[] {
  return docs
    .map((doc) => {
      const crudos = Array.isArray(doc.data.tiposQueRecibe)
        ? (doc.data.tiposQueRecibe as string[])
        : [];

      // Keep only what the app knows how to render, in canonical order, so two
      // banks accepting the same types never look different.
      const tipos = TIPOS_SANGRE.filter((tipo) => crudos.includes(tipo));
      const actualizadoEn = (doc.data.actualizadoEn as string | null | undefined) ?? null;

      return {
        id: doc.id,
        nombre: (doc.data.nombre as string | undefined) ?? "",
        direccion: (doc.data.direccion as string | null | undefined) ?? null,
        localidad: (doc.data.localidad as string | null | undefined) ?? null,
        horarioOficial: (doc.data.horarioOficial as string | null | undefined) ?? null,
        linkMaps: (doc.data.linkMaps as string | null | undefined) ?? null,
        tiposQueRecibe: tipos as TipoSangre[],
        resumenTipos: (doc.data.resumenTipos as string | null | undefined) ?? null,
        recibiendoHoy: doc.data.recibiendoHoy !== false,
        actualizadoEn,
        reportoHoy: reportoHoy(actualizadoEn),
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/**
 * The blood banks, read live from Firestore.
 *
 * Subscribed rather than fetched because this is the one list in the product
 * that goes stale within the hour: a bank that only wants O− at seven can be
 * taking everything by ten. A donor reading a cached page drives across the city
 * for nothing.
 *
 * It subscribes to every active bank and never to a filtered query, and that is
 * deliberate. Filtering by the donor's blood type happens in the component,
 * against this list. A blood type is sensitive health data; sending it to
 * Firestore as a query parameter would put it in Google's request logs for no
 * gain, since there are six banks and the whole list fits in one snapshot.
 */
export default function useBancosSangreRealtime(): Estado {
  const [estado, setEstado] = useState<Estado>({ data: null, isPending: true, isError: false });

  useEffect(() => {
    const db = getFirebaseDb();

    if (!db) {
      // No client SDK configured. Report it without a synchronous setState so the
      // caller can fall back to the API route.
      const timer = setTimeout(() => setEstado({ data: null, isPending: false, isError: true }), 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    const activos = query(collection(db, "bancosSangre"), where("activo", "==", true));

    const unsubscribe = onSnapshot(
      activos,
      (snapshot) => {
        if (cancelled) return;
        setEstado({
          data: mapear(snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }))),
          isPending: false,
          isError: false,
        });
      },
      (error) => {
        if (cancelled) return;
        if (process.env.NODE_ENV !== "production") {
          console.warn("bancosSangre onSnapshot:", error.message);
        }
        setEstado({ data: null, isPending: false, isError: true });
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return estado;
}
