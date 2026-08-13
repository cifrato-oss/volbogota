import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const TOKEN = "a".repeat(40);

vi.mock("@/server/config/env", () => ({
  env: { adminApiToken: TOKEN },
  isProduction: false,
  isDevelopment: true,
  isTest: true,
}));

const { requireAdmin } = await import("./auth");

function pedir(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/admin/reservas", { headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireAdmin", () => {
  it("accepts the token as a bearer", () => {
    expect(() => requireAdmin(pedir({ authorization: `Bearer ${TOKEN}` }))).not.toThrow();
  });

  it("accepts the token in x-admin-token", () => {
    expect(() => requireAdmin(pedir({ "x-admin-token": TOKEN }))).not.toThrow();
  });

  it("rejects a request with no token", () => {
    expect(() => requireAdmin(pedir())).toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }) as Error,
    );
  });

  it("rejects a wrong token of the same length", () => {
    expect(() => requireAdmin(pedir({ "x-admin-token": "b".repeat(40) }))).toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }) as Error,
    );
  });

  it("rejects a token that is only a prefix of the real one", () => {
    // The length mismatch must not short-circuit into a different outcome.
    expect(() => requireAdmin(pedir({ "x-admin-token": TOKEN.slice(0, 10) }))).toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }) as Error,
    );
  });

  it("ignores an Authorization header that is not a bearer", () => {
    expect(() => requireAdmin(pedir({ authorization: `Basic ${TOKEN}` }))).toThrow(
      expect.objectContaining({ code: "UNAUTHORIZED" }) as Error,
    );
  });
});
