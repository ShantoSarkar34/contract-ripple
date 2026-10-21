import type { CookieOptions, Request, RequestHandler, Response } from "express";
import type { Repository } from "../db/types.js";
import {
  csrfTokensMatch,
  resolveSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_PATH,
  type AuthContext,
} from "../services/session.js";
import { HttpError } from "./http-error.js";

export type CookieSameSite = "lax" | "strict" | "none";

export type AuthMiddlewareOptions = {
  repository: Repository;
  authSecret: string;
  allowedOrigins: string[];
  cookieSecure: boolean;
  cookieSameSite: CookieSameSite;
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function cookieOptions(options: AuthMiddlewareOptions): CookieOptions {
  return {
    httpOnly: true,
    secure: options.cookieSecure,
    sameSite: options.cookieSameSite,
    path: SESSION_COOKIE_PATH,
  };
}

export function setSessionCookie(
  response: Response,
  token: string,
  expiresAt: Date,
  options: AuthMiddlewareOptions,
): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    ...cookieOptions(options),
    expires: expiresAt,
  });
}

export function clearSessionCookie(
  response: Response,
  options: AuthMiddlewareOptions,
): void {
  response.clearCookie(SESSION_COOKIE_NAME, cookieOptions(options));
}

export function getSessionToken(request: Request): string | undefined {
  const value: unknown = request.cookies?.[SESSION_COOKIE_NAME];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function requireAuth(request: Request): AuthContext {
  if (!request.auth) {
    throw new HttpError(401, "unauthenticated", "Sign in to continue.");
  }
  return request.auth;
}

/**
 * Checks the Origin header when a browser supplies one. Requests without an
 * Origin header (CLI clients) still need the CSRF header for unsafe methods.
 */
export function originGuard(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (request, _response, next) => {
    if (SAFE_METHODS.has(request.method)) {
      next();
      return;
    }

    const origin = request.get("origin");
    if (origin && !allowed.has(origin)) {
      next(new HttpError(403, "invalid_origin", "This origin is not allowed to make changes."));
      return;
    }
    next();
  };
}

/**
 * Resolves the HttpOnly session cookie for every protected route and enforces a
 * session-bound CSRF token on unsafe methods.
 */
export function requireSession(options: AuthMiddlewareOptions): RequestHandler {
  return (request, response, next) => {
    void (async () => {
      const token = getSessionToken(request);
      const auth = await resolveSession(options.repository, token, options.authSecret);

      if (!auth) {
        if (token) {
          clearSessionCookie(response, options);
        }
        throw new HttpError(401, "unauthenticated", "Sign in to continue.");
      }

      if (!SAFE_METHODS.has(request.method)) {
        const provided = request.get("x-csrf-token");
        if (!csrfTokensMatch(auth.csrfToken, provided)) {
          throw new HttpError(
            403,
            "invalid_csrf",
            "The request could not be verified. Refresh the page and try again.",
          );
        }
      }

      request.auth = auth;
      next();
    })().catch(next);
  };
}
