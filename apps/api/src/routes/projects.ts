import { Router } from "express";
import {
  createProjectRequestSchema,
  updateProjectRequestSchema,
  type ListProjectsResponse,
} from "@contract-ripple/shared";
import type { Repository } from "../db/types.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { parseWithSchema } from "../middleware/validate.js";
import {
  enforceRateLimit,
  rateLimitKey,
  type RateLimitConfig,
} from "../services/rate-limit.js";
import { createProject, getProject, listProjects, updateProject } from "../services/projects.js";
import { requiredParam } from "./params.js";

export function createProjectsRouter(
  repository: Repository,
  rateLimits: RateLimitConfig,
): Router {
  const router = Router();

  router.post(
    "/projects",
    asyncHandler(async (request, response) => {
      const auth = requireAuth(request);
      await enforceRateLimit(
        repository,
        rateLimitKey("project:create:user", auth.user.id),
        rateLimits.createProjectPerUser,
      );

      const input = parseWithSchema(createProjectRequestSchema, request.body);
      const project = await createProject(repository, auth.user.id, input);
      response.status(201).json(project);
    }),
  );

  router.get(
    "/projects",
    asyncHandler(async (request, response) => {
      const auth = requireAuth(request);
      const projects = await listProjects(repository, auth.user.id);
      const body: ListProjectsResponse = { projects };
      response.status(200).json(body);
    }),
  );

  router.get(
    "/projects/:projectId",
    asyncHandler(async (request, response) => {
      const auth = requireAuth(request);
      const project = await getProject(
        repository,
        auth.user.id,
        requiredParam(request, "projectId"),
      );
      response.status(200).json(project);
    }),
  );

  router.patch(
    "/projects/:projectId",
    asyncHandler(async (request, response) => {
      const auth = requireAuth(request);
      const input = parseWithSchema(updateProjectRequestSchema, request.body);
      const project = await updateProject(
        repository,
        auth.user.id,
        requiredParam(request, "projectId"),
        input,
      );
      response.status(200).json(project);
    }),
  );

  return router;
}
