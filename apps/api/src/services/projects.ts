import type { CreateProjectRequest, ProjectDto, UpdateProjectRequest } from "@contract-ripple/shared";
import type { Repository } from "../db/types.js";
import { notFound } from "../middleware/http-error.js";
import { toProjectDto } from "./serialization.js";

export async function createProject(
  repository: Repository,
  input: CreateProjectRequest,
): Promise<ProjectDto> {
  const record = await repository.createProject(input);
  return toProjectDto({ ...record, contractCount: 0 });
}

export async function listProjects(repository: Repository): Promise<ProjectDto[]> {
  const records = await repository.listProjects();
  return records.map(toProjectDto);
}

export async function getProject(repository: Repository, projectId: string): Promise<ProjectDto> {
  const record = await repository.getProject(projectId);
  if (!record) {
    throw notFound("project_not_found", "Project not found.");
  }
  return toProjectDto(record);
}

export async function updateProject(
  repository: Repository,
  projectId: string,
  input: UpdateProjectRequest,
): Promise<ProjectDto> {
  const record = await repository.updateProject(projectId, input);
  if (!record) {
    throw notFound("project_not_found", "Project not found.");
  }
  const withCount = await repository.getProject(projectId);
  return toProjectDto(withCount ?? { ...record, contractCount: 0 });
}
