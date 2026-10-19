import { Router } from "express";
import type { Repository } from "../db/types.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { buildHealthResponse, checkReadiness } from "../services/health.js";

export function createHealthRouter(repository: Repository): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.status(200).json(buildHealthResponse());
  });

  router.get(
    "/ready",
    asyncHandler(async (_request, response) => {
      const { ready, response: body } = await checkReadiness(repository);
      response.status(ready ? 200 : 503).json(body);
    }),
  );

  return router;
}
