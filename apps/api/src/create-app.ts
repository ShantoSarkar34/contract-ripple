import cors from "cors";
import express, { type Express } from "express";
import type { Repository } from "./db/types.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createComparisonsRouter } from "./routes/comparisons.js";
import { createContractsRouter } from "./routes/contracts.js";
import { createHealthRouter } from "./routes/health.js";
import { createProjectsRouter } from "./routes/projects.js";
import { createSourceRouter } from "./routes/source.js";
import type { GitHubFetch } from "./services/github.js";

export type CreateAppOptions = {
  corsOrigins: string[];
  repository: Repository;
  githubToken?: string;
  githubApiBaseUrl?: string;
  githubFetch?: GitHubFetch;
};

/**
 * Contract uploads are sent as JSON strings, so the body limit is slightly
 * larger than the engine's 5 MiB per-document limit to allow for escaping.
 */
const JSON_BODY_LIMIT = "8mb";

/**
 * Builds the Express application without starting a listener. Keeping this
 * separate from `index.ts` makes the app testable and reusable.
 */
export function createApp({
  corsOrigins,
  repository,
  githubToken = "",
  githubApiBaseUrl,
  githubFetch,
}: CreateAppOptions): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: corsOrigins,
      exposedHeaders: ["Content-Disposition"],
    }),
  );
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  app.use("/api/v1", createHealthRouter(repository));
  app.use("/api/v1", createProjectsRouter(repository));
  app.use("/api/v1", createContractsRouter(repository));
  app.use("/api/v1", createComparisonsRouter(repository));
  app.use(
    "/api/v1",
    createSourceRouter(repository, { githubToken, githubApiBaseUrl, githubFetch }),
  );

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
