import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { env, isProduction } from "@/server/config/env";

import { forbidden, unauthorized } from "./errors";

/**
 * Gate for the coordinator endpoints.
 *
 * A shared token, not an identity system. For a four-day operation run by a
 * handful of coordinators on their phones it is the honest trade: no accounts
 * to create, nothing to reset at 2 a.m. The cost is real and worth stating —
 * **there is no audit trail per person**, and revoking access means rotating
 * the token for everyone. If this outlives the event, replace it with Firebase
 * Auth and custom claims.
 */
export function requireAdmin(request: NextRequest): void {
  const esperado = env.adminApiToken;

  if (!esperado) {
    // Production refuses to boot without the token, so this is a development
    // machine. Failing closed anyway keeps the two environments honest: an
    // endpoint that is open locally is an endpoint nobody tests the guard on.
    throw forbidden(
      isProduction
        ? "El panel no está disponible."
        : "Falta ADMIN_API_TOKEN en .env.local para usar /api/admin.",
    );
  }

  const recibido = leerToken(request);

  if (!recibido || !sonIguales(recibido, esperado)) {
    throw unauthorized("Token de administración inválido.");
  }
}

/** Accepts `Authorization: Bearer <token>` or `x-admin-token: <token>`. */
function leerToken(request: NextRequest): string | null {
  const bearer = request.headers.get("authorization");
  if (bearer?.toLowerCase().startsWith("bearer ")) {
    return bearer.slice(7).trim() || null;
  }

  return request.headers.get("x-admin-token")?.trim() || null;
}

/**
 * Constant-time comparison. `===` on secrets leaks their length and their
 * matching prefix through how long it takes to fail.
 */
function sonIguales(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");

  // timingSafeEqual throws on length mismatch, which would reintroduce the leak
  // it exists to prevent. Comparing each against itself keeps the work constant.
  if (bufferA.length !== bufferB.length) {
    timingSafeEqual(bufferA, bufferA);
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}
