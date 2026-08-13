import type { Firestore } from "firebase-admin/firestore";

import { env } from "@/server/config/env";
import { logger } from "@/server/lib/logger";

import { singleton } from "./client";
import { crearFirestore } from "./drivers/firestore.driver";
import { MemoryFirestore } from "./drivers/memory.driver";

/**
 * Where the data lives, chosen with `DB_DRIVER`.
 *
 * Everything above this file asks for `getDb()` and talks Firestore's API, so
 * the store is swappable without touching a single service or repository. Each
 * driver is self-contained in `./drivers`: removing one is deleting its file
 * and its branch of the switch below.
 *
 * - `firestore` — the real thing. Needs the emulator, a service-account key, or
 *   application-default credentials.
 * - `memory` — an in-process store that needs nothing at all. It implements the
 *   same optimistic concurrency Firestore does, so bookings still cannot
 *   oversell, and it is what the tests run against.
 */

export const COLLECTIONS = {
  centros: "centros",
  turnos: "turnos",
  reservas: "reservas",
  catalogos: "catalogos",
  /** Subcollection of `turnos`, one doc per phone number already booked. */
  inscritos: "inscritos",
  /** The donation catalogue: which items exist, in which category. */
  catalogoDonaciones: "catalogoDonaciones",
  /** Need state per centre × item, the "Quiero donar" semaphore. */
  necesidades: "necesidades",
} as const;

/**
 * The memory driver satisfies the slice of the Firestore API this codebase
 * uses, but it is not the SDK's class. One documented cast here is the price of
 * keeping every caller free of driver-specific types.
 */
function crearMemoria(): Firestore {
  return singleton("memory-db", () => {
    logger.warn(
      "DB_DRIVER=memory: los datos viven en memoria y se pierden al reiniciar. " +
        "Sirve para demos y desarrollo sin credenciales; no para producción con varias instancias.",
    );

    return new MemoryFirestore() as unknown as Firestore;
  });
}

export function getDb(): Firestore {
  return env.dbDriver === "memory" ? crearMemoria() : crearFirestore();
}
