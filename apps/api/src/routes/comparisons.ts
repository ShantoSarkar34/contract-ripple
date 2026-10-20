import { Router } from "express";
import {
  createComparisonRequestSchema,
  listComparisonsQuerySchema,
  reportQuerySchema,
} from "@contract-ripple/shared";
import type { Repository } from "../db/types.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { parseWithSchema } from "../middleware/validate.js";
import { createComparison, getComparison, listComparisons } from "../services/comparisons.js";
import { getComparisonReport, renderMarkdownReport } from "../services/reports.js";
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
      const query = parseWithSchema(listComparisonsQuerySchema, request.query);
      const body = await listComparisons(
        repository,
        requiredParam(request, "projectId"),
        query,
      );
      response.status(200).json(body);
    }),
  );

  router.get(
    "/comparisons/:comparisonId/report",
    asyncHandler(async (request, response) => {
      const query = parseWithSchema(reportQuerySchema, request.query);
      const report = await getComparisonReport(
        repository,
        requiredParam(request, "comparisonId"),
      );
      const safeId = report.comparison.id.replace(/[^a-zA-Z0-9_-]/g, "");
      response.setHeader("Cache-Control", "no-store");

      if (query.format === "markdown") {
        response
          .status(200)
          .attachment(`contract-ripple-${safeId}.md`)
          .type("text/markdown")
          .send(renderMarkdownReport(report));
        return;
      }

      response
        .status(200)
        .attachment(`contract-ripple-${safeId}.json`)
        .json(report);
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
