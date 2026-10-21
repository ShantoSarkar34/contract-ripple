import { describe, expect, it } from "vitest";
import { MemoryRepository } from "../db/memory-repository.js";
import { HttpError } from "../middleware/http-error.js";
import { TEST_OWNER_ID } from "../testing/auth.js";
import { createProject, getProject, listProjects, updateProject } from "./projects.js";

describe("project services", () => {
  it("creates a project and reports it with a zero contract count", async () => {
    const repository = new MemoryRepository();

    const project = await createProject(repository, TEST_OWNER_ID, {
      name: "Payments",
      description: "Pay APIs",
    });

    expect(project.name).toBe("Payments");
    expect(project.description).toBe("Pay APIs");
    expect(project.contractCount).toBe(0);
    expect(new Date(project.createdAt).toString()).not.toBe("Invalid Date");
  });

  it("lists only projects owned by the caller", async () => {
    const repository = new MemoryRepository();
    const project = await createProject(repository, TEST_OWNER_ID, { name: "Payments" });
    await repository.createContract({ projectId: project.id, name: "payments-api" });
    await createProject(repository, "someone-else", { name: "Not mine" });

    const projects = await listProjects(repository, TEST_OWNER_ID);

    expect(projects).toHaveLength(1);
    expect(projects[0]?.name).toBe("Payments");
    expect(projects[0]?.contractCount).toBe(1);
  });

  it("returns a stored project by id", async () => {
    const repository = new MemoryRepository();
    const created = await createProject(repository, TEST_OWNER_ID, { name: "Payments" });

    const found = await getProject(repository, TEST_OWNER_ID, created.id);

    expect(found.id).toBe(created.id);
    expect(found.name).toBe("Payments");
  });

  it("hides another owner's project behind a 404", async () => {
    const repository = new MemoryRepository();
    const created = await createProject(repository, "someone-else", { name: "Secret" });

    await expect(getProject(repository, TEST_OWNER_ID, created.id)).rejects.toMatchObject({
      name: "HttpError",
      status: 404,
      code: "project_not_found",
    });
  });

  it("throws a 404 HttpError for an unknown project", async () => {
    const repository = new MemoryRepository();

    await expect(getProject(repository, TEST_OWNER_ID, "missing")).rejects.toMatchObject({
      name: "HttpError",
      status: 404,
      code: "project_not_found",
    });
  });

  it("updates a project name and description", async () => {
    const repository = new MemoryRepository();
    const created = await createProject(repository, TEST_OWNER_ID, {
      name: "Old",
      description: "Before",
    });

    const updated = await updateProject(repository, TEST_OWNER_ID, created.id, {
      name: "New",
      description: "After",
    });

    expect(updated.name).toBe("New");
    expect(updated.description).toBe("After");
    expect(updated.contractCount).toBe(0);
  });

  it("does not update another owner's project", async () => {
    const repository = new MemoryRepository();
    const created = await createProject(repository, "someone-else", { name: "Secret" });

    await expect(
      updateProject(repository, TEST_OWNER_ID, created.id, { name: "Hijacked" }),
    ).rejects.toMatchObject({ status: 404, code: "project_not_found" });
  });

  it("throws a 404 when updating an unknown project", async () => {
    const repository = new MemoryRepository();

    await expect(
      updateProject(repository, TEST_OWNER_ID, "missing", { name: "New" }),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
