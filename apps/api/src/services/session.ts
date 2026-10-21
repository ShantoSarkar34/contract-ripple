import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type {
  AuthSessionResponse,
  AuthUserDto,
} from "@contract-ripple/shared";
import type {
  Repository,
  SessionRecord,
  UserRecord,
} from "../db/types.js";

export const SESSION_COOKIE_NAME = "cr_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE_PATH = "/api/v1";

export type AuthContext = {
  user: UserRecord;
  session: SessionRecord;
  csrfToken: string;
};

export type NewAuthSession = {
  user: UserRecord;
  session: SessionRecord;
  token: string;
  csrfToken: string;
  expiresAt: Date;
};

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * The CSRF token is derived from the raw session token and a server secret.
 * It can be recomputed for `/auth/me` without storing a second token in the
 * database. It is only useful to someone who already knows the session token.
 */
export function deriveCsrfToken(sessionToken: string, authSecret: string): string {
  return createHmac("sha256", authSecret)
    .update(`contract-ripple-csrf:${sessionToken}`, "utf8")
    .digest("base64url");
}

export function csrfTokensMatch(expected: string, provided: string | undefined): boolean {
  if (!provided) {
    return false;
  }
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");
  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function sessionExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_MS);
}

export function toAuthUserDto(user: UserRecord): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toAuthSessionResponse(
  user: UserRecord,
  csrfToken: string,
  expiresAt: Date,
): AuthSessionResponse {
  return {
    user: toAuthUserDto(user),
    csrfToken,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function createSession(
  repository: Repository,
  user: UserRecord,
  authSecret: string,
  now: Date = new Date(),
): Promise<NewAuthSession> {
  const token = createSessionToken();
  const expiresAt = sessionExpiresAt(now);
  const session = await repository.createSession({
    userId: user.id,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });

  return {
    user,
    session,
    token,
    csrfToken: deriveCsrfToken(token, authSecret),
    expiresAt,
  };
}

/**
 * Resolves a raw cookie token. Expired sessions are deleted so a stolen-but-
 * expired token cannot be revived. Returns null for unknown/expired sessions.
 */
export async function resolveSession(
  repository: Repository,
  token: string | undefined,
  authSecret: string,
  now: Date = new Date(),
): Promise<AuthContext | null> {
  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const session = await repository.getSessionByTokenHash(tokenHash);
  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= now.getTime()) {
    await repository.deleteSessionByTokenHash(tokenHash);
    return null;
  }

  return {
    user: session.user,
    session,
    csrfToken: deriveCsrfToken(token, authSecret),
  };
}
