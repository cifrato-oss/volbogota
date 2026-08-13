import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const TOKEN = "a".repeat(40);

vi.mock("@/server/config/env", () => ({
  env: { adminApiToken: TOKEN },
  isProduction: false,
  isDevelopment: true,
  isTest: true,
}));

/**
 * `requireAdmin` reads the session before it looks at the token, and that read
 * would reach Firestore. None of these cases carry a cookie, so the stub only
 * has to answer "no session" — asserting it is never called with a value keeps
 * the test honest about which path it is exercising.
 */
vi.mock("@/server/modules/admin/sesiones", () => ({
  COOKIE_SESION: "volbogota_sesion",
  leerSesion: vi.fn(async (token: string | undefined) => {
    if (token) throw new Error("Este test no debería llegar a Firestore.");
    return null;
  }),
}));

const { requireAdmin } = await import("./auth");

function pedir(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/admin/reservas", { headers });
}

const noAutorizado = expect.objectContaining({ code: "UNAUTHORIZED" }) as Error;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireAdmin", () => {
  it("accepts the token as a bearer", async () => {
    await expect(requireAdmin(pedir({ authorization: `Bearer ${TOKEN}` }))).resolves.toEqual({
      tipo: "token",
    });
  });

  it("accepts the token in x-admin-token", async () => {
    await expect(requireAdmin(pedir({ "x-admin-token": TOKEN }))).resolves.toEqual({
      tipo: "token",
    });
  });

  it("rejects a request with no token", async () => {
    await expect(requireAdmin(pedir())).rejects.toThrow(noAutorizado);
  });

  it("rejects a wrong token of the same length", async () => {
    await expect(requireAdmin(pedir({ "x-admin-token": "b".repeat(40) }))).rejects.toThrow(
      noAutorizado,
    );
  });

  it("rejects a token that is only a prefix of the real one", async () => {
    // The length mismatch must not short-circuit into a different outcome.
    await expect(requireAdmin(pedir({ "x-admin-token": TOKEN.slice(0, 10) }))).rejects.toThrow(
      noAutorizado,
    );
  });

  it("ignores an Authorization header that is not a bearer", async () => {
    await expect(requireAdmin(pedir({ authorization: `Basic ${TOKEN}` }))).rejects.toThrow(
      noAutorizado,
    );
  });
});
