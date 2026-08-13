import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * Client-side Firestore, for live reads via `onSnapshot`. Uses the public
 * `NEXT_PUBLIC_FIREBASE_*` config (safe in the browser). Writes stay closed by
 * the security rules — the client only ever subscribes to public collections.
 */

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let cached: Firestore | null = null;

/**
 * Returns the client Firestore, or `null` when it can't run: on the server, or
 * when the public config is absent (e.g. against the emulator). Callers then
 * fall back to polling.
 */
export function getFirebaseDb(): Firestore | null {
  if (typeof window === "undefined") return null;
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) return null;
  if (cached) return cached;

  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  cached = getFirestore(app);
  return cached;
}
