import { existsSync } from "node:fs";
import { join } from "node:path";

import { applicationDefault, cert, getApps, initializeApp, type App } from "firebase-admin/app";
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

  // An explicit service-account key, when there is one.
  if (env.firebase.configured) {
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

  /**
   * Otherwise fall back to Application Default Credentials.
   *
   * Downloadable service-account keys are not always an option: an
   * organisation can forbid creating them outright with
   * `constraints/iam.disableServiceAccountKeyCreation`, and that is a guardrail
   * worth respecting rather than working around. ADC covers both ways out —
   * `gcloud auth application-default login` on a developer machine, and the
   * attached runtime identity when this deploys onto Cloud Run or App Hosting,
   * where there is no key to leak in the first place.
   */
  if (hayCredencialesPorDefecto()) {
    return initializeApp({
      credential: applicationDefault(),
      projectId: env.firebase.projectId || undefined,
    });
  }

  // A missing configuration is not an unexpected failure, and reporting it as
  // one costs real time: a generic 500 sends whoever is debugging looking for
  // a bug in the request. Saying what is missing, in development, turns "the
  // backend does not respond" into a one-line fix.
  throw serviceUnavailable(
    isProduction
      ? "El servicio no está disponible en este momento."
      : "Firestore no está configurado. Hay tres caminos: el emulador " +
          "(FIRESTORE_EMULATOR_HOST=localhost:8080), una cuenta de servicio " +
          "(FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY en .env), o credenciales por " +
          "defecto (`gcloud auth application-default login`).",
  );
}

/**
 * Whether ADC is likely to resolve, without paying a network round trip to find
 * out. Covers the explicit env var, the file `gcloud` writes, and running on
 * Google infrastructure, where the metadata server provides the identity.
 */
function hayCredencialesPorDefecto(): boolean {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return true;
  // Set by Cloud Run, App Engine, Cloud Functions and App Hosting.
  if (process.env.K_SERVICE || process.env.GAE_SERVICE || process.env.FUNCTION_TARGET) return true;

  const home = process.env.HOME ?? process.env.USERPROFILE;
  if (!home) return false;

  return existsSync(join(home, ".config", "gcloud", "application_default_credentials.json"));
}

export function getDb(): Firestore {
  return singleton("firestore", () => {
    const db = getFirestore(createApp());
    db.settings({ ignoreUndefinedProperties: true });
    return db;
  });
}
