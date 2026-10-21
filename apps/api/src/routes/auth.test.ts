import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ApiErrorResponse, AuthSessionResponse } from "@contract-ripple/shared";
import { createApp } from "../create-app.js";
import { MemoryRepository } from "../db/memory-repository.js";
import {
  registerTestUser,
  TEST_AUTH_SECRET,
  withSession,
  type TestSession,
} from "../testing/auth.js";
import { startTestServer, type TestServer } from "../testing/http.js";

const ORIGIN = "http://localhost:3000";

let server: TestServer;

beforeAll(async () => {
  const app = createApp({
    corsOrigins: [ORIGIN],
    repository: new MemoryRepository(),
    authSecret: TEST_AUTH_SECRET,
    nodeEnv: "test",
    trustProxy: false,
  });
  server = await startTestServer(app);
});

afterAll(async () => {
  await server.close();
});

function url(path: string): string {
  return `${server.baseUrl}/api/v1${path}`;
}

describe("authentication routes", () => {
  it("registers a user, sets an HttpOnly session cookie, and returns a CSRF token", async () => {
    const response = await fetch(url("/auth/register"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "  Alice@Example.COM ",
        password: "a-long-enough-password",
      }),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const setCookie = response.headers.getSetCookie().find((value) => value.startsWith("cr_session="));
    expect(setCookie).toBeDefined();
    expect(setCookie?.toLowerCase()).toContain("httponly");
    expect(setCookie?.toLowerCase()).toContain("samesite=lax");
    expect(setCookie?.toLowerCase()).toContain("path=/api/v1");

    const body = (await response.json()) as AuthSessionResponse;
    expect(body.user.email).toBe("alice@example.com");
    expect(body.csrfToken).toHaveLength(43);
    expect(body.expiresAt).toBeTruthy();
    expect(JSON.stringify(body)).not.toContain("password");
  });

  it("validates registration input", async () => {
    const response = await fetch(url("/auth/register"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "short" }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("validation_error");
  });

  it("rejects a duplicate email with a conflict", async () => {
    await registerTestUser(server.baseUrl, "duplicate@example.test");
    const response = await fetch(url("/auth/register"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "duplicate@example.test", password: "a-long-enough-password" }),
    });

    expect(response.status).toBe(409);
    expect(((await response.json()) as ApiErrorResponse).error.code).toBe("email_taken");
  });

  it("logs in, resolves /auth/me, and logs out", async () => {
    const session = await registerTestUser(server.baseUrl, "session@example.test");

    const me = await fetch(url("/auth/me"), withSession(session));
    expect(me.status).toBe(200);
    const meBody = (await me.json()) as AuthSessionResponse;
    expect(meBody.user.id).toBe(session.user.id);
    expect(meBody.csrfToken).toBe(session.csrfToken);

    const login = await fetch(url("/auth/login"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "session@example.test", password: "a-very-long-test-password" }),
    });
    expect(login.status).toBe(200);

    const logout = await fetch(url("/auth/logout"), withSession(session, { method: "POST" }));
    expect(logout.status).toBe(204);

    const afterLogout = await fetch(url("/auth/me"), withSession(session));
    expect(afterLogout.status).toBe(401);
  });

  it("rejects a login with the wrong password", async () => {
    await registerTestUser(server.baseUrl, "wrong-pass@example.test");
    const response = await fetch(url("/auth/login"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "wrong-pass@example.test", password: "not-the-password" }),
    });

    expect(response.status).toBe(401);
    expect(((await response.json()) as ApiErrorResponse).error.code).toBe(
      "invalid_credentials",
    );
  });

  it("requires a CSRF token for unsafe authenticated requests", async () => {
    const session = await registerTestUser(server.baseUrl, "csrf@example.test");

    const response = await fetch(url("/projects"), {
      method: "POST",
      headers: { "content-type": "application/json", cookie: session.cookie },
      body: JSON.stringify({ name: "No CSRF" }),
    });

    expect(response.status).toBe(403);
    expect(((await response.json()) as ApiErrorResponse).error.code).toBe("invalid_csrf");
  });

  it("does not allow logout without a CSRF token", async () => {
    const session = await registerTestUser(server.baseUrl, "logout-csrf@example.test");

    const response = await fetch(url("/auth/logout"), {
      method: "POST",
      headers: { cookie: session.cookie },
    });
    expect(response.status).toBe(403);

    const me = await fetch(url("/auth/me"), withSession(session));
    expect(me.status).toBe(200);
  });

  it("rejects mutations from a disallowed origin", async () => {
    const response = await fetch(url("/auth/login"), {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ email: "nobody@example.test", password: "a-long-enough-password" }),
    });

    expect(response.status).toBe(403);
    expect(((await response.json()) as ApiErrorResponse).error.code).toBe("invalid_origin");
  });

  it("sets hardening headers and allows credentialed CORS preflight", async () => {
    const preflight = await fetch(url("/projects"), {
      method: "OPTIONS",
      headers: {
        origin: ORIGIN,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,x-csrf-token",
      },
    });

    expect([200, 204]).toContain(preflight.status);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(preflight.headers.get("access-control-allow-credentials")).toBe("true");

    const health = await fetch(url("/health"));
    expect(health.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("authentication rate limiting", () => {
  it("returns 429 with Retry-After once the login limit is exceeded", async () => {
    const repository = new MemoryRepository();
    const app = createApp({
      corsOrigins: [ORIGIN],
      repository,
      authSecret: TEST_AUTH_SECRET,
      nodeEnv: "test",
      trustProxy: false,
      rateLimits: {
        loginPerIp: { limit: 2, windowMs: 60_000 },
        loginPerEmail: { limit: 10, windowMs: 60_000 },
      },
    });
    const limitedServer = await startTestServer(app);

    try {
      const attempt = (index: number) =>
        fetch(`${limitedServer.baseUrl}/api/v1/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            email: `limited-${index}@example.test`,
            password: "a-long-enough-password",
          }),
        });

      expect((await attempt(1)).status).toBe(401);
      expect((await attempt(2)).status).toBe(401);

      const blocked = await attempt(3);
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("retry-after")).toBeTruthy();
      expect(((await blocked.json()) as ApiErrorResponse).error.code).toBe("rate_limited");
    } finally {
      await limitedServer.close();
    }
  });
});
