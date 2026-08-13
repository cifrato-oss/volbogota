import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

import { env, isProduction } from "@/server/config/env";
import { serviceUnavailable } from "@/server/http/errors";

import { singleton } from "./client";

/**
 * Firestore is the runtime store: it serves reads during the event and absorbs
 * concurrent bookings through transactions. The spreadsheet stays the
 * administrative source and is pushed here by `scripts/import-excel.ts`.
 */

export const COLLECTIONS = {
  centros: "centros",
  turnos: "turnos",
  reservas: "reservas",
  catalogos: "catalogos",
  /** Subcollection of `turnos`, one doc per phone number already booked. */
  inscritos: "inscritos",
} as const;

/** Set by `firebase emulators:start`; the SDK routes to it automatically. */
const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

function createApp(): App {
  // Reuse the app the Next.js dev server already initialized on a previous reload.
  const [existing] = getApps();
  if (existing) return existing;

  // The emulator accepts any project id and ignores credentials entirely.
  if (usingEmulator) {
    return initializeApp({ projectId: env.firebase.projectId || "volbogota-local" });
  }

  if (!env.firebase.configured) {
    // A missing configuration is not an unexpected failure, and reporting it as
    // one costs real time: a generic 500 sends whoever is debugging looking for
    // a bug in the request. Saying what is missing, in development, turns "the
    // backend does not respond" into a one-line fix.
    throw serviceUnavailable(
      isProduction
        ? "El servicio no está disponible en este momento."
        : "Firestore no está configurado. Completa FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL y " +
            "FIREBASE_PRIVATE_KEY en .env (ver .env.example), o levanta el emulador con " +
            "FIRESTORE_EMULATOR_HOST=localhost:8080.",
    );
  }

  return initializeApp({
    credential: cert({
      projectId: env.firebase.projectId,
      clientEmail: env.firebase.clientEmail,
      // Vercel and most CI systems store the key with escaped newlines.
      privateKey: env.firebase.privateKey.replace(/\\n/g, "\n"),
    }),
    projectId: env.firebase.projectId,
  });
}

export function getDb(): Firestore {
  return singleton("firestore", () => {
    const db = getFirestore(createApp());
    db.settings({ ignoreUndefinedProperties: true });
    return db;
  });
}
