import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import type { Repository } from "./db/types.js";
import type { NodeEnvironment } from "./config/env.js";
import {
  originGuard,
  requireSession,
  type CookieSameSite,
} from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createAuthRouter } from "./routes/auth.js";
import { createComparisonsRouter } from "./routes/comparisons.js";
import { createContractsRouter } from "./routes/contracts.js";
import { createHealthRouter } from "./routes/health.js";
import { createProjectsRouter } from "./routes/projects.js";
import { createSourceRouter } from "./routes/source.js";
import {
  mergeRateLimits,
  type RateLimitConfig,
} from "./services/rate-limit.js";
import type { GitHubFetch } from "./services/github.js";

export type CreateAppOptions = {
  corsOrigins: string[];
  repository: Repository;
  authSecret: string;
  nodeEnv?: NodeEnvironment;
  cookieSecure?: boolean;
  cookieSameSite?: CookieSameSite;
  trustProxy?: boolean;
  rateLimits?: Partial<RateLimitConfig>;
  githubToken?: string;
  githubApiBaseUrl?: string;
  githubFetch?: GitHubFetch;
};

/**
 * Contract uploads are sent as JSON strings, so the body limit is slightly
 * larger than the engine's 5 MiB per-document limit to allow for escaping.
 */
const JSON_BODY_LIMIT = "8mb";

/** Authentication payloads are tiny; keep their parser separate and strict. */
const AUTH_JSON_BODY_LIMIT = "32kb";

/**
 * Builds the Express application without starting a listener. Keeping this
 * separate from `index.ts` makes the app testable and reusable.
 */
export function createApp({
  corsOrigins,
  repository,
  authSecret,
  nodeEnv = "test",
  cookieSecure = nodeEnv === "production",
  cookieSameSite = "lax",
  trustProxy = nodeEnv === "production",
  rateLimits,
  githubToken = "",
  githubApiBaseUrl,
  githubFetch,
}: CreateAppOptions): Express {
  const app = express();
  const authOptions = {
    repository,
    authSecret,
    allowedOrigins: corsOrigins,
    cookieSecure,
    cookieSameSite,
  };
  const limits = mergeRateLimits(rateLimits);

  app.disable("x-powered-by");
  app.set("trust proxy", trustProxy);
  app.use(
    helmet({
      // This service returns JSON and downloads, never HTML documents.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "no-referrer" },
      strictTransportSecurity: nodeEnv === "production" ? { maxAge: 15552000 } : false,
    }),
  );
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token"],
      exposedHeaders: ["Content-Disposition", "Retry-After"],
    }),
  );
  app.use(cookieParser());

  // API responses contain user data and must never be shared by caches.
  app.use("/api/v1", (_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });

  app.use("/api/v1", createHealthRouter(repository));

  // Liveness/readiness stay public; every other route is authenticated below.
  app.use("/api/v1", originGuard(corsOrigins));
  app.use(
    "/api/v1/auth",
    express.json({ limit: AUTH_JSON_BODY_LIMIT }),
    createAuthRouter({
      repository,
      auth: authOptions,
      rateLimits: limits,
    }),
  );

  // Authenticate before parsing large bodies so unauthenticated requests cannot
  // make the API buffer megabytes of JSON or multipart data.
  app.use("/api/v1", requireSession(authOptions));
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use("/api/v1", createProjectsRouter(repository, limits));
  app.use("/api/v1", createContractsRouter(repository));
  app.use("/api/v1", createComparisonsRouter(repository, limits));
  app.use(
    "/api/v1",
    createSourceRouter(repository, { githubToken, githubApiBaseUrl, githubFetch }, limits),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
