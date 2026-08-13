import { describe, expect, it, vi } from "vitest";

// `buscarUsuario` pulls in the Firestore client at import time. These tests only
// exercise the hashing, which touches no database.
vi.mock("@/server/db/firestore", () => ({
  COLLECTIONS: { usuarios: "usuarios" },
  getDb: () => {
    throw new Error("Estas pruebas no deberían tocar Firestore.");
  },
}));

const { hashPassword, verificarPassword } = await import("./usuarios");

describe("hashPassword", () => {
  it("verifies the password it was made from", async () => {
    const hash = await hashPassword("una contraseña larga y correcta");

    await expect(verificarPassword("una contraseña larga y correcta", hash)).resolves.toBe(true);
  });

  it("rejects a different password", async () => {
    const hash = await hashPassword("una contraseña larga y correcta");

    await expect(verificarPassword("otra contraseña distinta", hash)).resolves.toBe(false);
  });

  it("gives two different digests for the same password", async () => {
    // Each hash carries its own random salt. Equal digests would mean the salt
    // is not being used, and that a stolen dump would reveal who shares a
    // password with whom.
    const uno = await hashPassword("la misma contraseña de siempre");
    const otro = await hashPassword("la misma contraseña de siempre");

    expect(uno).not.toEqual(otro);
  });

  it("records the cost parameters in the value", async () => {
    // They are what makes the cost raisable later without invalidating every
    // password already stored.
    const hash = await hashPassword("una contraseña larga y correcta");

    expect(hash.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(hash.split("$")).toHaveLength(6);
  });

  it("treats the same password written in different unicode forms as equal", async () => {
    // "contraseña" typed on a Mac can carry a combining tilde while the same
    // word from a phone keyboard carries a precomposed ñ. Same password to a
    // human, different bytes to scrypt, and a login that fails for no visible
    // reason.
    const compuesta = "contraseña-muy-larga";
    const precompuesta = "contraseña-muy-larga";

    expect(compuesta).not.toEqual(precompuesta);

    const hash = await hashPassword(compuesta);
    await expect(verificarPassword(precompuesta, hash)).resolves.toBe(true);
  });
});

describe("verificarPassword", () => {
  it("returns false instead of throwing on a malformed stored value", async () => {
    // A document written by hand in the console can hold anything. A typo in the
    // hash is a failed login, not a 500 that tells whoever is trying that they
    // found a real account.
    for (const roto of [
      "",
      "no-es-un-hash",
      "scrypt$$$$$",
      "bcrypt$1$2$3$4$5",
      "scrypt$a$b$c$d$e",
    ]) {
      await expect(verificarPassword("cualquier cosa", roto)).resolves.toBe(false);
    }
  });
});
