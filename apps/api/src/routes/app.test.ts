import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  AnalysisRunDetailDto,
  ApiErrorResponse,
  ContractDto,
  ContractVersionDto,
  ListAnalysesResponse,
  ListContractsResponse,
  ListProjectsResponse,
  ListVersionsResponse,
  ProjectDto,
  ReadyResponse,
} from "@contract-ripple/shared";
import { createApp } from "../app.js";
import { MemoryRepository } from "../db/memory-repository.js";
import {
  baselinePetJson,
  candidatePetJson,
  invalidOpenApiJson,
  malformedContent,
  unsupportedVersionJson,
} from "../testing/fixtures.js";
import { startTestServer, type TestServer } from "../testing/http.js";

let server: TestServer;

beforeAll(async () => {
  const app = createApp({
    corsOrigins: ["http://localhost:3000"],
    repository: new MemoryRepository(),
  });
  server = await startTestServer(app);
});

afterAll(async () => {
  await server.close();
});

async function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${server.baseUrl}/api/v1${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
}

describe("API routes", () => {
  it("reports health and readiness", async () => {
    const health = await api("/health");
    expect(health.status).toBe(200);

    const ready = await api("/ready");
    expect(ready.status).toBe(200);
    const body = (await ready.json()) as ReadyResponse;
    expect(body).toEqual({
      status: "ok",
      database: "up",
      timestamp: expect.any(String),
    });
  });

  it("validates project input", async () => {
    const response = await api("/projects", {
      method: "POST",
      body: JSON.stringify({ name: "" }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("validation_error");
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it("returns a not_found envelope for unknown routes", async () => {
    const response = await api("/does-not-exist");
    expect(response.status).toBe(404);
    const body = (await response.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("not_found");
  });

  it("supports the full project → contract → version → comparison flow", async () => {
    const projectResponse = await api("/projects", {
      method: "POST",
      body: JSON.stringify({ name: "Pets", description: "Pet store" }),
    });
    expect(projectResponse.status).toBe(201);
    const project = (await projectResponse.json()) as ProjectDto;

    const projectsResponse = await api("/projects");
    expect(projectsResponse.status).toBe(200);
    const projects = (await projectsResponse.json()) as ListProjectsResponse;
    expect(projects.projects.some((entry) => entry.id === project.id)).toBe(true);

    const contractResponse = await api(`/projects/${project.id}/contracts`, {
      method: "POST",
      body: JSON.stringify({ name: "pets-api" }),
    });
    expect(contractResponse.status).toBe(201);
    const contract = (await contractResponse.json()) as ContractDto;

    const contractsResponse = await api(`/projects/${project.id}/contracts`);
    const contracts = (await contractsResponse.json()) as ListContractsResponse;
    expect(contracts.contracts.map((entry) => entry.id)).toContain(contract.id);

    const baselineResponse = await api(`/contracts/${contract.id}/versions`, {
      method: "POST",
      body: JSON.stringify({ content: baselinePetJson, label: "v1" }),
    });
    expect(baselineResponse.status).toBe(201);
    const baseline = (await baselineResponse.json()) as ContractVersionDto;

    const candidateResponse = await api(`/contracts/${contract.id}/versions`, {
      method: "POST",
      body: JSON.stringify({ content: candidatePetJson, label: "v2" }),
    });
    expect(candidateResponse.status).toBe(201);
    const candidate = (await candidateResponse.json()) as ContractVersionDto;

    const versionsResponse = await api(`/contracts/${contract.id}/versions`);
    const versions = (await versionsResponse.json()) as ListVersionsResponse;
    expect(versions.versions.map((entry) => entry.label)).toEqual(["v1", "v2"]);

    const comparisonResponse = await api(`/projects/${project.id}/comparisons`, {
      method: "POST",
      body: JSON.stringify({
        baselineVersionId: baseline.id,
        candidateVersionId: candidate.id,
      }),
    });
    expect(comparisonResponse.status).toBe(201);
    const comparison = (await comparisonResponse.json()) as AnalysisRunDetailDto;
    expect(comparison.findings.length).toBe(comparison.totalFindings);
    expect(comparison.findings.length).toBeGreaterThan(0);

    const detailResponse = await api(`/comparisons/${comparison.id}`);
    expect(detailResponse.status).toBe(200);
    const detail = (await detailResponse.json()) as AnalysisRunDetailDto;
    expect(detail.findings.map((finding) => finding.id)).toEqual(
      comparison.findings.map((finding) => finding.id),
    );

    const listResponse = await api(`/projects/${project.id}/comparisons`);
    const list = (await listResponse.json()) as ListAnalysesResponse;
    expect(list.analyses.map((entry) => entry.id)).toContain(comparison.id);

    const versionDetailResponse = await api(`/versions/${baseline.id}`);
    expect(versionDetailResponse.status).toBe(200);
    const versionDetail = (await versionDetailResponse.json()) as { content: string };
    expect(versionDetail.content).toBe(baselinePetJson);
  });

  it("rejects an unknown project with 404", async () => {
    const response = await api("/projects/does-not-exist");
    expect(response.status).toBe(404);
    const body = (await response.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("project_not_found");
  });

  it("rejects an invalid OpenAPI version with 422 and a safe error code", async () => {
    const projectResponse = await api("/projects", {
      method: "POST",
      body: JSON.stringify({ name: "Invalid specs" }),
    });
    const project = (await projectResponse.json()) as ProjectDto;
    const contractResponse = await api(`/projects/${project.id}/contracts`, {
      method: "POST",
      body: JSON.stringify({ name: "broken-api" }),
    });
    const contract = (await contractResponse.json()) as ContractDto;

    const response = await api(`/contracts/${contract.id}/versions`, {
      method: "POST",
      body: JSON.stringify({ content: invalidOpenApiJson }),
    });

    expect(response.status).toBe(422);
    const body = (await response.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("invalid_openapi");
  });

  it("rejects an unsupported OpenAPI version with 422", async () => {
    const projectResponse = await api("/projects", {
      method: "POST",
      body: JSON.stringify({ name: "Old specs" }),
    });
    const project = (await projectResponse.json()) as ProjectDto;
    const contractResponse = await api(`/projects/${project.id}/contracts`, {
      method: "POST",
      body: JSON.stringify({ name: "old-api" }),
    });
    const contract = (await contractResponse.json()) as ContractDto;

    const response = await api(`/contracts/${contract.id}/versions`, {
      method: "POST",
      body: JSON.stringify({ content: unsupportedVersionJson }),
    });

    expect(response.status).toBe(422);
    const body = (await response.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("unsupported_version");
  });

  it("rejects malformed contract content with a 400", async () => {
    const projectResponse = await api("/projects", {
      method: "POST",
      body: JSON.stringify({ name: "Malformed" }),
    });
    const project = (await projectResponse.json()) as ProjectDto;
    const contractResponse = await api(`/projects/${project.id}/contracts`, {
      method: "POST",
      body: JSON.stringify({ name: "malformed-api" }),
    });
    const contract = (await contractResponse.json()) as ContractDto;

    const response = await api(`/contracts/${contract.id}/versions`, {
      method: "POST",
      body: JSON.stringify({ content: malformedContent }),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("invalid_yaml");
  });
});
