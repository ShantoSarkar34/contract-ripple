import { describe, expect, it } from "vitest";
import { MemoryRepository } from "../db/memory-repository.js";
import { TEST_AUTH_SECRET } from "../testing/auth.js";
import { loginUser, registerUser, signOut } from "./auth.js";
import {
  deriveCsrfToken,
  hashSessionToken,
  resolveSession,
} from "./session.js";

describe("auth service", () => {
  it("registers a user and issues a session with a derived CSRF token", async () => {
    const repository = new MemoryRepository();

    const result = await registerUser(
      repository,
      { email: " User@Example.COM ", password: "a-long-enough-password" },
      TEST_AUTH_SECRET,
    );

    expect(result.response.user.email).toBe("user@example.com");
    expect(result.response.user.id).toBeTruthy();
    expect(JSON.stringify(result.response)).not.toContain("password");
    expect(result.response.csrfToken).toBe(
      deriveCsrfToken(result.token, TEST_AUTH_SECRET),
    );

    const resolved = await resolveSession(repository, result.token, TEST_AUTH_SECRET);
    expect(resolved?.user.email).toBe("user@example.com");
  });

  it("rejects a duplicate email regardless of case", async () => {
    const repository = new MemoryRepository();
    await registerUser(
      repository,
      { email: "user@example.com", password: "a-long-enough-password" },
      TEST_AUTH_SECRET,
    );

    await expect(
      registerUser(
        repository,
        { email: "USER@example.com", password: "another-long-password" },
        TEST_AUTH_SECRET,
      ),
    ).rejects.toMatchObject({ status: 409, code: "email_taken" });
  });

  it("logs in with the correct password and rejects incorrect credentials", async () => {
    const repository = new MemoryRepository();
    await registerUser(
      repository,
      { email: "user@example.com", password: "a-long-enough-password" },
      TEST_AUTH_SECRET,
    );

    const login = await loginUser(
      repository,
      { email: "USER@example.com", password: "a-long-enough-password" },
      TEST_AUTH_SECRET,
    );
    expect(login.response.user.email).toBe("user@example.com");

    await expect(
      loginUser(
        repository,
        { email: "user@example.com", password: "the-wrong-password" },
        TEST_AUTH_SECRET,
      ),
    ).rejects.toMatchObject({ status: 401, code: "invalid_credentials" });

    await expect(
      loginUser(
        repository,
        { email: "nobody@example.com", password: "a-long-enough-password" },
        TEST_AUTH_SECRET,
      ),
    ).rejects.toMatchObject({ status: 401, code: "invalid_credentials" });
  });

  it("revokes a session on sign out", async () => {
    const repository = new MemoryRepository();
    const result = await registerUser(
      repository,
      { email: "user@example.com", password: "a-long-enough-password" },
      TEST_AUTH_SECRET,
    );

    await signOut(repository, result.token);

    await expect(
      resolveSession(repository, result.token, TEST_AUTH_SECRET),
    ).resolves.toBeNull();
  });

  it("treats an expired session as invalid and deletes it", async () => {
    const repository = new MemoryRepository();
    const user = await repository.createUser({
      email: "user@example.com",
      passwordHash: "scrypt$1024$8$1$c2FsdHNhbHQ=$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNo",
    });
    const token = "expired-token-value";
    await repository.createSession({
      userId: user.id,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(
      resolveSession(repository, token, TEST_AUTH_SECRET),
    ).resolves.toBeNull();

    await expect(repository.getSessionByTokenHash(hashSessionToken(token))).resolves.toBeNull();
  });
});
