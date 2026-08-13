import type { NextRequest } from "next/server";
import type { z } from "zod";

import { logger, serializeError } from "@/server/lib/logger";

import { AppError, internalError, isAppError, unprocessable } from "./errors";
import { fail } from "./responses";

export type RouteHandler<TContext = unknown> = (
  request: NextRequest,
  context: TContext,
) => Promise<Response> | Response;

/**
 * Wraps a route handler so every thrown error becomes a consistent failure
 * envelope. Handlers stay focused on the happy path: parse, delegate to a
 * service, format the result.
 *
 * ```ts
 * export const GET = withRoute(async (_request, ctx: RouteContext<"/api/teams/[id]">) => {
 *   const { id } = await ctx.params;
 *   return ok(await getTeam(id));
 * });
 * ```
 */
export function withRoute<TContext>(handler: RouteHandler<TContext>): RouteHandler<TContext> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return toErrorResponse(error, request);
    }
  };
}

function toErrorResponse(error: unknown, request: NextRequest): Response {
  if (isAppError(error)) {
    // Client mistakes are expected traffic; only server faults deserve an alert.
    if (error.status >= 500) {
      logger.error(error.message, {
        method: request.method,
        path: new URL(request.url).pathname,
        ...serializeError(error),
      });
    }
    return fail(error);
  }

  logger.error("Unhandled route error", {
    method: request.method,
    path: new URL(request.url).pathname,
    ...serializeError(error),
  });

  // Never leak internals to the client.
  return fail(internalError());
}

/**
 * Parses and validates a JSON body, throwing a 422 with per-field details when
 * it does not match the schema.
 */
export async function parseJsonBody<TSchema extends z.ZodType>(
  request: NextRequest,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    throw unprocessable("El cuerpo de la solicitud debe ser JSON válido.");
  }

  return validate(schema, raw);
}

/** Parses and validates the query string of a request. */
export function parseSearchParams<TSchema extends z.ZodType>(
  request: NextRequest,
  schema: TSchema,
): z.infer<TSchema> {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  return validate(schema, params);
}

function validate<TSchema extends z.ZodType>(schema: TSchema, value: unknown): z.infer<TSchema> {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw unprocessable(
      "Los datos enviados no son válidos.",
      result.error.issues.map((issue) => ({
        field: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    );
  }

  return result.data;
}

export { AppError };
