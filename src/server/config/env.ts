import { z } from "zod";

/**
 * Environment configuration, validated once at module load.
 *
 * Server-only values go in `serverSchema`. Anything the browser needs must be
 * prefixed with `NEXT_PUBLIC_` and referenced literally (Next.js inlines those
 * at build time, so `process.env[name]` with a computed key does not work).
 *
 * Add a variable here first, then to `.env.example`, then use it.
 */

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Firebase service account. Required in production; optional elsewhere so the
  // web app and the test suite run without credentials. `getDb()` fails with a
  // precise message if something actually reaches Firestore without them.
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

/**
 * `next build` runs with NODE_ENV=production while collecting page data, but a
 * build machine legitimately has no runtime secrets — CI builds every PR without
 * them. Requiring credentials there would only prove the CI runner has none.
 * They are still enforced when the server actually boots.
 */
const buildingForProduction =
  process.env.NEXT_PHASE === "phase-production-build" || process.env.SKIP_ENV_VALIDATION === "true";

const parsed = serverSchema
  .extend(clientSchema.shape)
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== "production" || buildingForProduction) return;

    for (const key of [
      "FIREBASE_PROJECT_ID",
      "FIREBASE_CLIENT_EMAIL",
      "FIREBASE_PRIVATE_KEY",
    ] as const) {
      if (!value[key]) {
        ctx.addIssue({ code: "custom", path: [key], message: "Requerida en producción." });
      }
    }
  })
  .safeParse({
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment variables:\n${detail}`);
}

const firebaseConfigured = Boolean(
  parsed.data.FIREBASE_PROJECT_ID &&
  parsed.data.FIREBASE_CLIENT_EMAIL &&
  parsed.data.FIREBASE_PRIVATE_KEY,
);

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  logLevel: parsed.data.LOG_LEVEL,
  appUrl: parsed.data.NEXT_PUBLIC_APP_URL,
  firebase: {
    configured: firebaseConfigured,
    projectId: parsed.data.FIREBASE_PROJECT_ID ?? "",
    clientEmail: parsed.data.FIREBASE_CLIENT_EMAIL ?? "",
    privateKey: parsed.data.FIREBASE_PRIVATE_KEY ?? "",
  },
} as const;

export const isProduction = env.nodeEnv === "production";
export const isDevelopment = env.nodeEnv === "development";
export const isTest = env.nodeEnv === "test";
