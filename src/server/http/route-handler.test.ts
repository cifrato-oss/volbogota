import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { ApiFailure } from "@/types/api";

import { notFound } from "./errors";
import { ok } from "./responses";
import { parseJsonBody, withRoute } from "./route-handler";

function jsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("withRoute", () => {
  it("passes through the handler response", async () => {
    const handler = withRoute(async () => ok({ id: "1" }));

    const response = await handler(new NextRequest("http://localhost/api/test"), undefined);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, data: { id: "1" } });
  });

  it("maps an AppError to its status and failure envelope", async () => {
    const handler = withRoute(async () => {
      throw notFound("El equipo no existe.");
    });

    const response = await handler(new NextRequest("http://localhost/api/test"), undefined);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: "NOT_FOUND", message: "El equipo no existe." },
    });
  });

  it("hides unexpected errors behind a 500", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const handler = withRoute(async () => {
      throw new Error("connection string leaked here");
    });

    const response = await handler(new NextRequest("http://localhost/api/test"), undefined);
    const payload = (await response.json()) as ApiFailure;

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(JSON.stringify(payload)).not.toContain("connection string");

    vi.restoreAllMocks();
  });
});

describe("parseJsonBody", () => {
  const schema = z.object({ name: z.string().min(1), age: z.number().int() });

  it("returns the parsed body when it matches the schema", async () => {
    await expect(parseJsonBody(jsonRequest({ name: "Ana", age: 30 }), schema)).resolves.toEqual({
      name: "Ana",
      age: 30,
    });
  });

  it("rejects an invalid body with a 422 and per-field details", async () => {
    const handler = withRoute(async (request: NextRequest) => {
      await parseJsonBody(request, schema);
      return ok(null);
    });

    const response = await handler(jsonRequest({ name: "", age: "treinta" }), undefined);
    const payload = (await response.json()) as ApiFailure;

    expect(response.status).toBe(422);
    expect(payload.error.code).toBe("UNPROCESSABLE_ENTITY");
    expect(payload.error.details).toEqual([
      expect.objectContaining({ field: "name" }),
      expect.objectContaining({ field: "age" }),
    ]);
  });

  it("rejects a malformed JSON payload", async () => {
    const request = new NextRequest("http://localhost/api/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not json",
    });

    await expect(parseJsonBody(request, schema)).rejects.toMatchObject({
      code: "UNPROCESSABLE_ENTITY",
    });
  });
});
