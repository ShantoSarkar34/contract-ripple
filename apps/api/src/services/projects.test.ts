import { describe, expect, it } from "vitest";
import { MemoryRepository } from "../db/memory-repository.js";
import { HttpError } from "../middleware/http-error.js";
import { createProject, getProject, listProjects, updateProject } from "./projects.js";

describe("project services", () => {
  it("creates a project and reports it with a zero contract count", async () => {
    const repository = new MemoryRepository();

    const project = await createProject(repository, { name: "Payments", description: "Pay APIs" });

    expect(project.name).toBe("Payments");
    expect(project.description).toBe("Pay APIs");
    expect(project.contractCount).toBe(0);
    expect(new Date(project.createdAt).toString()).not.toBe("Invalid Date");
  });

  it("lists projects with their contract counts", async () => {
    const repository = new MemoryRepository();
    const project = await createProject(repository, { name: "Payments" });
    await repository.createContract({ projectId: project.id, name: "payments-api" });

    const projects = await listProjects(repository);

    expect(projects).toHaveLength(1);
    expect(projects[0]?.contractCount).toBe(1);
  });

  it("returns a stored project by id", async () => {
    const repository = new MemoryRepository();
    const created = await createProject(repository, { name: "Payments" });

    const found = await getProject(repository, created.id);

    expect(found.id).toBe(created.id);
    expect(found.name).toBe("Payments");
  });

  it("throws a 404 HttpError for an unknown project", async () => {
    const repository = new MemoryRepository();

    await expect(getProject(repository, "missing")).rejects.toMatchObject({
      name: "HttpError",
      status: 404,
      code: "project_not_found",
    });
  });

  it("updates a project name and description", async () => {
    const repository = new MemoryRepository();
    const created = await createProject(repository, { name: "Old", description: "Before" });

    const updated = await updateProject(repository, created.id, {
      name: "New",
      description: "After",
    });

    expect(updated.name).toBe("New");
    expect(updated.description).toBe("After");
    expect(updated.contractCount).toBe(0);
  });

  it("throws a 404 when updating an unknown project", async () => {
    const repository = new MemoryRepository();

    await expect(
      updateProject(repository, "missing", { name: "New" }),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
