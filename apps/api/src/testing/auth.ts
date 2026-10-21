import type { AuthSessionResponse } from "@contract-ripple/shared";
import { SESSION_COOKIE_NAME } from "../services/session.js";

export const TEST_AUTH_SECRET =
  "test-auth-secret-value-that-is-at-least-32-characters-long";

/** Owner id used by service-level tests that do not authenticate over HTTP. */
export const TEST_OWNER_ID = "owner_test";

export type TestSession = {
  cookie: string;
  csrfToken: string;
  user: AuthSessionResponse["user"];
};

function sessionCookieFrom(response: Response): string {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];
  const match = setCookies.find((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (!match) {
    throw new Error("The response did not set a session cookie.");
  }
  const [pair] = match.split(";");
  if (!pair) {
    throw new Error("The session cookie header was malformed.");
  }
  return pair;
}

let emailCounter = 0;

/** Registers a unique user over real HTTP and returns its cookie and CSRF token. */
export async function registerTestUser(
  baseUrl: string,
  email = `user-${(emailCounter += 1)}@example.test`,
  password = "a-very-long-test-password",
): Promise<TestSession> {
  const response = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (response.status !== 201) {
    throw new Error(`Test user registration failed with status ${response.status}.`);
  }

  const body = (await response.json()) as AuthSessionResponse;
  return { cookie: sessionCookieFrom(response), csrfToken: body.csrfToken, user: body.user };
}

/** Adds the session cookie and, for unsafe methods, the CSRF header. */
export function withSession(session: TestSession, init: RequestInit = {}): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("cookie", session.cookie);
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    headers.set("x-csrf-token", session.csrfToken);
  }
  if (typeof init.body === "string" && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return { ...init, headers };
}
