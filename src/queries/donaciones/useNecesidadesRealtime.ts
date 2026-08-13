import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";

import { CATEGORIAS_DONACION, SEMAFORO_POR_ESTADO } from "@/constants/donaciones";
import { getFirebaseDb } from "@/lib/firebase-client";
import type {
  CategoriaDonacion,
  EstadoNecesidad,
  NecesidadElemento,
  NecesidadesCategoria,
  NecesidadesDeCentro,
} from "@/types/donaciones";

type Estado = {
  data: NecesidadesDeCentro | null;
  isPending: boolean;
  isError: boolean;
};

/** Builds the grouped, sorted view straight from the raw Firestore docs. */
function mapear(
  centroId: string,
  docs: Array<{ id: string; data: Record<string, unknown> }>,
): NecesidadesDeCentro {
  const centroNombre = (docs[0]?.data.centroNombre as string | undefined) ?? "";

  const porCategoria = new Map<CategoriaDonacion, NecesidadElemento[]>(
    CATEGORIAS_DONACION.map((categoria) => [categoria, []]),
  );

  for (const doc of docs) {
    const categoria = doc.data.categoria as CategoriaDonacion;
    const estado = doc.data.estado as EstadoNecesidad;
    porCategoria.get(categoria)?.push({
      id: doc.id,
      elementoId: doc.data.elementoId as string,
      elemento: doc.data.elemento as string,
      estado,
      semaforo: SEMAFORO_POR_ESTADO[estado],
      actualizadoEn: (doc.data.actualizadoEn as string | null | undefined) ?? null,
    });
  }

  const categorias: NecesidadesCategoria[] = CATEGORIAS_DONACION.map((categoria) => {
    const elementos = (porCategoria.get(categoria) ?? []).sort((a, b) =>
      a.elemento.localeCompare(b.elemento, "es"),
    );
    return {
      categoria,
      mensaje: null,
      necesita: elementos.some((elemento) => elemento.estado === "SE_NECESITA"),
      elementos,
    };
  }).filter((categoria) => categoria.elementos.length > 0);

  return { centroId, centroNombre, categorias };
}

/**
 * A center's donation needs, read live from Firestore. Subscribes to just this
 * center's `necesidades` docs and re-renders the instant a coordinator flips a
 * semaphore — no API round trip, no polling. The rules allow public reads of
 * this collection.
 */
export default function useNecesidadesRealtime(centroId: string | undefined): Estado {
  const [estado, setEstado] = useState<Estado>({ data: null, isPending: true, isError: false });

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db || !centroId) {
      // Nothing to subscribe to; report it without a synchronous setState.
      const timer = setTimeout(
        () => setEstado({ data: null, isPending: false, isError: Boolean(centroId) }),
        0,
      );
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    const necesidadesDelCentro = query(
      collection(db, "necesidades"),
      where("centroId", "==", centroId),
    );

    const unsubscribe = onSnapshot(
      necesidadesDelCentro,
      (snapshot) => {
        if (cancelled) return;
        const docs = snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
        setEstado({ data: mapear(centroId, docs), isPending: false, isError: false });
      },
      (error) => {
        if (cancelled) return;
        if (process.env.NODE_ENV !== "production") {
          console.warn("necesidades onSnapshot:", error.message);
        }
        setEstado({ data: null, isPending: false, isError: true });
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [centroId]);

  return estado;
}
