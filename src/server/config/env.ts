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
  // DATABASE_URL: z.url(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
});

const parsed = serverSchema.extend(clientSchema.shape).safeParse({
  NODE_ENV: process.env.NODE_ENV,
  LOG_LEVEL: process.env.LOG_LEVEL,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  // DATABASE_URL: process.env.DATABASE_URL,
});

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment variables:\n${detail}`);
}

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  logLevel: parsed.data.LOG_LEVEL,
  appUrl: parsed.data.NEXT_PUBLIC_APP_URL,
} as const;

export const isProduction = env.nodeEnv === "production";
export const isDevelopment = env.nodeEnv === "development";
export const isTest = env.nodeEnv === "test";
