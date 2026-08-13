import { describe, expect, it } from "vitest";

import { generarCodigo, hashCelular } from "./reservas.repository";

describe("hashCelular", () => {
  it("is stable for the same number, so deduplication keeps working", () => {
    expect(hashCelular("3001234567")).toBe(hashCelular("3001234567"));
  });

  it("separates different numbers", () => {
    expect(hashCelular("3001234567")).not.toBe(hashCelular("3001234568"));
  });

  it("never contains the number it came from", () => {
    expect(hashCelular("3001234567")).not.toContain("3001234567");
  });

  it("is keyed, not a plain digest of the number", () => {
    // The whole point of the fix: a bare sha256 of a Colombian mobile is
    // reversible by precomputing ~3e9 candidates. If this ever matches, the
    // secret stopped being applied and every digest became reversible again.
    const sinSal = "9f86d081884c7d659a2feaa0c55ad015"; // sha256("test") truncated
    expect(hashCelular("test")).not.toBe(sinSal);
  });

  it("produces a fixed-width hex digest", () => {
    expect(hashCelular("3001234567")).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("generarCodigo", () => {
  it("uses the VB- prefix and eight symbols", () => {
    expect(generarCodigo()).toMatch(/^VB-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
  });

  it("excludes characters that get misread out loud", () => {
    // O/0 and I/1/L are the pairs that get transcribed wrong at a check-in desk.
    const codigos = Array.from({ length: 400 }, generarCodigo).join("");

    expect(codigos).not.toMatch(/[O0IL1]/);
  });

  it("does not repeat across a run far larger than the event", () => {
    const codigos = new Set(Array.from({ length: 20_000 }, generarCodigo));

    expect(codigos.size).toBe(20_000);
  });

  it("spreads across the whole alphabet instead of favouring its start", () => {
    // Rejection sampling exists so that a modulo bias does not concentrate
    // codes on the first 256 % 31 = 8 symbols. The prefix is dropped here or it
    // would contribute its own letters to the tally.
    const simbolos = Array.from({ length: 2000 }, () => generarCodigo().slice(3)).join("");
    const usados = new Set(simbolos.split(""));

    expect(usados.size).toBe(31);

    // The last symbols of the alphabet are exactly the ones a modulo bias
    // would under-represent.
    expect(usados.has("Y")).toBe(true);
    expect(usados.has("Z")).toBe(true);
  });
});
