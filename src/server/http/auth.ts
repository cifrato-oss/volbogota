import { timingSafeEqual } from "node:crypto";

import type { NextRequest } from "next/server";

import { env, isProduction } from "@/server/config/env";
import { COOKIE_SESION, leerSesion } from "@/server/modules/admin/sesiones";

import { forbidden, unauthorized } from "./errors";

/**
 * Gate for the coordinator endpoints.
 *
 * Two ways in, and the order matters.
 *
 * A session cookie is the panel's way: a person logs in with an account from
 * the `usuarios` collection and every request carries an opaque token that names
 * them. That is what gives the panel an audit trail and lets one coordinator be
 * revoked without touching the rest.
 *
 * The shared token stays as the second way, for the things a browser is not:
 * `curl` during an incident, a script, a health check from a machine that has no
 * session. It has no identity attached, so anything done with it is attributable
 * only to "someone holding the token".
 *
 * Returns who the caller is, so a route that records an action can store the
 * person rather than the fact that somebody was authorised.
 */
export async function requireAdmin(request: NextRequest): Promise<QuienLlama> {
  const sesion = await leerSesion(request.cookies.get(COOKIE_SESION)?.value);
  if (sesion) return { tipo: "usuario", usuario: sesion.usuario, nombre: sesion.nombre };

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

  const recibido = leerToken(request, "x-admin-token");

  if (!recibido || !sonIguales(recibido, esperado)) {
    throw unauthorized("Inicia sesión para entrar al panel.");
  }

  return { tipo: "token" };
}

export type QuienLlama = { tipo: "usuario"; usuario: string; nombre: string } | { tipo: "token" };

/**
 * Gate for the spreadsheet sync hooks.
 *
 * A separate secret from the admin token, not the same one reused: the master
 * sheet is shared with more people than the coordinator panel, and its script
 * carries the token in a place anyone with edit access can read. Keeping them
 * apart means rotating one does not lock the other out.
 */
export function requireSheetsHook(request: NextRequest): void {
  const esperado = env.sheetsHookToken;

  if (!esperado) {
    throw forbidden(
      isProduction
        ? "La sincronización con la hoja no está disponible."
        : "Falta SHEETS_HOOK_TOKEN en .env.local para usar /api/hooks/sheets.",
    );
  }

  const recibido = leerToken(request, "x-sheets-token");

  if (!recibido || !sonIguales(recibido, esperado)) {
    throw unauthorized("Token de sincronización inválido.");
  }
}

/** Accepts `Authorization: Bearer <token>` or the caller's own header. */
function leerToken(request: NextRequest, header: string): string | null {
  const bearer = request.headers.get("authorization");
  if (bearer?.toLowerCase().startsWith("bearer ")) {
    return bearer.slice(7).trim() || null;
  }

  return request.headers.get(header)?.trim() || null;
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
