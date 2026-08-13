/**
 * Minimal structured logger.
 *
 * Emits single-line JSON in production so log drains can parse it, and a
 * readable line in development. Swap the sink here if a provider is added
 * later (Datadog, Axiom, Pino…) — call sites stay untouched.
 */

import { env, isProduction } from "@/server/config/env";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[env.logLevel];
}

function write(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...context,
  };

  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;

  if (isProduction) {
    sink(JSON.stringify(entry));
    return;
  }

  sink(`[${level}] ${message}`, context ?? "");
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};

/** Normalizes anything thrown into something safe to log. */
export function serializeError(error: unknown): LogContext {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "UnknownError", message: String(error) };
}
