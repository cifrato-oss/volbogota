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

  // Where the data lives. `memory` runs the whole app with no credentials at
  // all — useful for a demo or a first run — at the cost of losing everything
  // on restart and not surviving more than one instance.
  DB_DRIVER: z.enum(["firestore", "memory"]).default("firestore"),

  // Firebase service account. Required in production; optional elsewhere so the
  // web app and the test suite run without credentials. `getDb()` fails with a
  // precise message if something actually reaches Firestore without them.
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  // Secret key for the per-shift deduplication digest of a phone number.
  // A plain hash would not protect anything: Colombian mobiles span about
  // 3e9 values, so the whole dictionary precomputes in seconds and every
  // digest reverses. The secret is what makes it irreversible.
  CELULAR_HASH_SALT: z
    .string()
    .min(32, "Debe tener al menos 32 caracteres para ser un secreto útil.")
    .optional(),

  // Shared secret for the coordinator endpoints under /api/admin. Those return
  // volunteer names, phones and ages, so the token is what stands between that
  // data and the open internet.
  ADMIN_API_TOKEN: z
    .string()
    .min(32, "Debe tener al menos 32 caracteres para ser un secreto útil.")
    .optional(),

  // Shared secret the spreadsheet's Apps Script presents to /api/hooks/sheets.
  // Those endpoints write the catalogue and create reservations, so this is what
  // separates them from anyone who finds the URL. Kept separate from the admin
  // token because the sheet is shared with more people than the panel is, and
  // revoking one should not force rotating the other.
  //
  // Not required in production on purpose: the hooks fail closed without it, so
  // a deploy that happens before the script is installed is safe, not broken.
  SHEETS_HOOK_TOKEN: z
    .string()
    .min(32, "Debe tener al menos 32 caracteres para ser un secreto útil.")
    .optional(),

  // The spreadsheet's Apps Script web app, for the other direction: pushing
  // reservations into the sheet so a volunteer who signed up on the web shows
  // up on the list the coordinators read at the door.
  //
  // Optional: without it the push is skipped silently, which is the right
  // behaviour before the script is deployed. It reuses SHEETS_HOOK_TOKEN, since
  // both ends of the same sync answer to the same shared secret.
  SHEETS_WEBHOOK_URL: z.url("Debe ser la URL del despliegue del Apps Script.").optional(),
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

    for (const key of ["FIREBASE_PROJECT_ID", "CELULAR_HASH_SALT", "ADMIN_API_TOKEN"] as const) {
      if (!value[key]) {
        ctx.addIssue({ code: "custom", path: [key], message: "Requerida en producción." });
      }
    }

    /**
     * The service-account pair is deliberately not required.
     *
     * Downloadable keys do not always exist: an organisation can forbid issuing
     * them with `constraints/iam.disableServiceAccountKeyCreation`, and this
     * project runs under one that does. Demanding the key here would refuse to
     * boot on precisely the deployments that need no key — Cloud Run and Firebase
     * App Hosting attach the service account to the service itself — and the ADC
     * fallback in `db/firestore.ts` would never be reached.
     *
     * Half a pair, on the other hand, is always a mistake worth catching at boot
     * rather than on the first request.
     */
    const email = Boolean(value.FIREBASE_CLIENT_EMAIL);
    const key = Boolean(value.FIREBASE_PRIVATE_KEY);

    if (email !== key) {
      ctx.addIssue({
        code: "custom",
        path: [email ? "FIREBASE_PRIVATE_KEY" : "FIREBASE_CLIENT_EMAIL"],
        message:
          "Van las dos o ninguna: con una sola no se puede firmar, y sin ninguna se usan las " +
          "credenciales por defecto del entorno (ADC).",
      });
    }
  })
  .safeParse({
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    DB_DRIVER: process.env.DB_DRIVER,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
    CELULAR_HASH_SALT: process.env.CELULAR_HASH_SALT,
    ADMIN_API_TOKEN: process.env.ADMIN_API_TOKEN,
    SHEETS_HOOK_TOKEN: process.env.SHEETS_HOOK_TOKEN,
    SHEETS_WEBHOOK_URL: process.env.SHEETS_WEBHOOK_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment variables:\n${detail}`);
}

/**
 * Development and test only. Real data never touches this value: production
 * refuses to boot without its own secret, so a digest built here can never end
 * up in a live database.
 */
const SAL_DE_DESARROLLO = "volbogota-desarrollo-sal-no-usar-en-produccion";

const firebaseConfigured = Boolean(
  parsed.data.FIREBASE_PROJECT_ID &&
  parsed.data.FIREBASE_CLIENT_EMAIL &&
  parsed.data.FIREBASE_PRIVATE_KEY,
);

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  logLevel: parsed.data.LOG_LEVEL,
  dbDriver: parsed.data.DB_DRIVER,
  appUrl: parsed.data.NEXT_PUBLIC_APP_URL,
  celularHashSalt: parsed.data.CELULAR_HASH_SALT ?? SAL_DE_DESARROLLO,
  adminApiToken: parsed.data.ADMIN_API_TOKEN ?? null,
  sheetsHookToken: parsed.data.SHEETS_HOOK_TOKEN ?? null,
  sheetsWebhookUrl: parsed.data.SHEETS_WEBHOOK_URL ?? null,
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
