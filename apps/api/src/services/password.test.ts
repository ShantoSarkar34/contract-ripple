import { describe, expect, it } from "vitest";
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
  type PasswordHashOptions,
} from "./password.js";

/** Cheap parameters keep the test suite fast while exercising the real codec. */
const FAST: PasswordHashOptions = {
  N: 1024,
  r: 8,
  p: 1,
  keyLength: 32,
  maxmem: 16 * 1024 * 1024,
  saltBytes: 8,
};

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("correct horse battery staple", FAST);

    expect(hash.startsWith("scrypt$1024$8$1$")).toBe(true);
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password entirely", hash)).resolves.toBe(false);
  });

  it("uses a unique salt for every hash", async () => {
    const first = await hashPassword("same password value", FAST);
    const second = await hashPassword("same password value", FAST);

    expect(first).not.toBe(second);
    await expect(verifyPassword("same password value", first)).resolves.toBe(true);
    await expect(verifyPassword("same password value", second)).resolves.toBe(true);
  });

  it("returns false for malformed or unsupported hashes", async () => {
    for (const value of [
      "",
      "not-a-hash",
      "scrypt$1024$8$1$onlyfiveparts",
      "bcrypt$1024$8$1$c2FsdA==$aGFzaA==",
      "scrypt$3$8$1$c2FsdA==$aGFzaA==",
      "scrypt$999999999$8$1$c2FsdA==$aGFzaA==",
    ]) {
      await expect(verifyPassword("anything", value)).resolves.toBe(false);
    }
  });

  it("ships a dummy hash that verifies against its known input", async () => {
    expect(DUMMY_PASSWORD_HASH.startsWith("scrypt$")).toBe(true);
    await expect(
      verifyPassword("contract-ripple-dummy-password-not-a-credential", DUMMY_PASSWORD_HASH),
    ).resolves.toBe(true);
  });
});
