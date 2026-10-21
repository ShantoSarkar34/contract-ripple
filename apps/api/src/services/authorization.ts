import type { ProjectRecordWithCount, Repository } from "../db/types.js";
import { notFound } from "../middleware/http-error.js";

/**
 * Ownership is always checked server-side against the project row. Returning a
 * not-found response for another user's resource avoids confirming that an id
 * exists while keeping the API's error model consistent.
 */
export async function requireProject(
  repository: Repository,
  ownerId: string,
  projectId: string,
): Promise<ProjectRecordWithCount> {
  const project = await repository.getProject(projectId);
  if (!project || project.ownerId !== ownerId) {
    throw notFound("project_not_found", "Project not found.");
  }
  return project;
}
