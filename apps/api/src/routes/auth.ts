import { Router, type Request, type Response } from "express";
import {
  loginRequestSchema,
  registerRequestSchema,
} from "@contract-ripple/shared";
import type { Repository } from "../db/types.js";
import { asyncHandler } from "../middleware/async-handler.js";
import {
  clearSessionCookie,
  getSessionToken,
  requireAuth,
  requireSession,
  setSessionCookie,
  type AuthMiddlewareOptions,
} from "../middleware/auth.js";
import { HttpError } from "../middleware/http-error.js";
import { parseWithSchema } from "../middleware/validate.js";
import { loginUser, registerUser, signOut } from "../services/auth.js";
import {
  enforceRateLimit,
  rateLimitKey,
  type RateLimitConfig,
} from "../services/rate-limit.js";
import {
  csrfTokensMatch,
  resolveSession,
  toAuthSessionResponse,
} from "../services/session.js";

export type AuthRouterOptions = {
  repository: Repository;
  auth: AuthMiddlewareOptions;
  rateLimits: RateLimitConfig;
};

function clientIp(request: Request): string {
  return request.ip ?? request.socket.remoteAddress ?? "unknown";
}

function noStore(response: Response): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Pragma", "no-cache");
}

export function createAuthRouter({
  repository,
  auth,
  rateLimits,
}: AuthRouterOptions): Router {
  const router = Router();
  const requireCurrentSession = requireSession(auth);

  router.use((_request, response, next) => {
    noStore(response);
    next();
  });

  router.post(
    "/register",
    asyncHandler(async (request, response) => {
      await enforceRateLimit(
        repository,
        rateLimitKey("register:ip", clientIp(request)),
        rateLimits.registerPerIp,
      );

      const input = parseWithSchema(registerRequestSchema, request.body);
      const result = await registerUser(repository, input, auth.authSecret);
      setSessionCookie(response, result.token, result.expiresAt, auth);
      response.status(201).json(result.response);
    }),
  );

  router.post(
    "/login",
    asyncHandler(async (request, response) => {
      const input = parseWithSchema(loginRequestSchema, request.body);
      await enforceRateLimit(
        repository,
        rateLimitKey("login:ip", clientIp(request)),
        rateLimits.loginPerIp,
      );
      await enforceRateLimit(
        repository,
        rateLimitKey("login:email", input.email),
        rateLimits.loginPerEmail,
      );

      const result = await loginUser(repository, input, auth.authSecret);
      setSessionCookie(response, result.token, result.expiresAt, auth);
      response.status(200).json(result.response);
    }),
  );

  router.get(
    "/me",
    requireCurrentSession,
    asyncHandler(async (request, response) => {
      const current = requireAuth(request);
      response.status(200).json(
        toAuthSessionResponse(
          current.user,
          current.csrfToken,
          current.session.expiresAt,
        ),
      );
    }),
  );

  router.post(
    "/logout",
    asyncHandler(async (request, response) => {
      const token = getSessionToken(request);
      const current = await resolveSession(repository, token, auth.authSecret);

      if (current) {
        const provided = request.get("x-csrf-token");
        if (!csrfTokensMatch(current.csrfToken, provided)) {
          throw new HttpError(
            403,
            "invalid_csrf",
            "The request could not be verified. Refresh the page and try again.",
          );
        }
        await signOut(repository, token);
      }

      clearSessionCookie(response, auth);
      response.status(204).send();
    }),
  );

  return router;
}
