import type { CreateProjectRequest, ProjectDto, UpdateProjectRequest } from "@contract-ripple/shared";
import type { Repository } from "../db/types.js";
import { notFound } from "../middleware/http-error.js";
import { requireProject } from "./authorization.js";
import { toProjectDto } from "./serialization.js";

export async function createProject(
  repository: Repository,
  ownerId: string,
  input: CreateProjectRequest,
): Promise<ProjectDto> {
  const record = await repository.createProject({ ...input, ownerId });
  return toProjectDto({ ...record, contractCount: 0 });
}

export async function listProjects(repository: Repository, ownerId: string): Promise<ProjectDto[]> {
  const records = await repository.listProjects(ownerId);
  return records.map(toProjectDto);
}

export async function getProject(
  repository: Repository,
  ownerId: string,
  projectId: string,
): Promise<ProjectDto> {
  return toProjectDto(await requireProject(repository, ownerId, projectId));
}

export async function updateProject(
  repository: Repository,
  ownerId: string,
  projectId: string,
  input: UpdateProjectRequest,
): Promise<ProjectDto> {
  await requireProject(repository, ownerId, projectId);

  const record = await repository.updateProject(projectId, input);
  if (!record) {
    throw notFound("project_not_found", "Project not found.");
  }
  const withCount = await repository.getProject(projectId);
  return toProjectDto(withCount ?? { ...record, contractCount: 0 });
}
