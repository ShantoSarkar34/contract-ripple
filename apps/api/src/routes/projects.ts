import { Router } from "express";
import {
  createProjectRequestSchema,
  updateProjectRequestSchema,
  type ListProjectsResponse,
} from "@contract-ripple/shared";
import type { Repository } from "../db/types.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { parseWithSchema } from "../middleware/validate.js";
import { createProject, getProject, listProjects, updateProject } from "../services/projects.js";
import { requiredParam } from "./params.js";

export function createProjectsRouter(repository: Repository): Router {
  const router = Router();

  router.post(
    "/projects",
    asyncHandler(async (request, response) => {
      const input = parseWithSchema(createProjectRequestSchema, request.body);
      const project = await createProject(repository, input);
      response.status(201).json(project);
    }),
  );

  router.get(
    "/projects",
    asyncHandler(async (_request, response) => {
      const projects = await listProjects(repository);
      const body: ListProjectsResponse = { projects };
      response.status(200).json(body);
    }),
  );

  router.get(
    "/projects/:projectId",
    asyncHandler(async (request, response) => {
      const project = await getProject(repository, requiredParam(request, "projectId"));
      response.status(200).json(project);
    }),
  );

  router.patch(
    "/projects/:projectId",
    asyncHandler(async (request, response) => {
      const input = parseWithSchema(updateProjectRequestSchema, request.body);
      const project = await updateProject(repository, requiredParam(request, "projectId"), input);
      response.status(200).json(project);
    }),
  );

  return router;
}
