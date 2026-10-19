import { Router } from "express";
import {
  createComparisonRequestSchema,
  type ListAnalysesResponse,
} from "@contract-ripple/shared";
import type { Repository } from "../db/types.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { parseWithSchema } from "../middleware/validate.js";
import { createComparison, getComparison, listComparisons } from "../services/comparisons.js";
import { requiredParam } from "./params.js";

export function createComparisonsRouter(repository: Repository): Router {
  const router = Router();

  router.post(
    "/projects/:projectId/comparisons",
    asyncHandler(async (request, response) => {
      const input = parseWithSchema(createComparisonRequestSchema, request.body);
      const analysis = await createComparison(
        repository,
        requiredParam(request, "projectId"),
        input,
      );
      response.status(201).json(analysis);
    }),
  );

  router.get(
    "/projects/:projectId/comparisons",
    asyncHandler(async (request, response) => {
      const analyses = await listComparisons(repository, requiredParam(request, "projectId"));
      const body: ListAnalysesResponse = { analyses };
      response.status(200).json(body);
    }),
  );

  router.get(
    "/comparisons/:comparisonId",
    asyncHandler(async (request, response) => {
      const analysis = await getComparison(repository, requiredParam(request, "comparisonId"));
      response.status(200).json(analysis);
    }),
  );

  return router;
}
