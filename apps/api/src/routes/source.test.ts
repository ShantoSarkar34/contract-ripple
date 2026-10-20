import { strToU8, zipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  ApiErrorResponse,
  GitHubStatusResponse,
  ListSourceSnapshotsResponse,
  SourceSnapshotDetailDto,
} from "@contract-ripple/shared";
import { createApp } from "../app.js";
import { MemoryRepository } from "../db/memory-repository.js";
import { createComparison } from "../services/comparisons.js";
import { createContract, createContractVersion } from "../services/contracts.js";
import { createProject } from "../services/projects.js";
import { baselinePetJson, candidatePetJson } from "../testing/fixtures.js";
import { startTestServer, type TestServer } from "../testing/http.js";

let server: TestServer;
let repository: MemoryRepository;
let projectId: string;
let comparisonId: string;

const CLIENT_SOURCE = `
fetch("/pets", { method: "POST" });
axios.get("/pets");
fetch("/owners");
`;

function buildZip(): Uint8Array {
  return zipSync({ "src/client.ts": strToU8(CLIENT_SOURCE) });
}

beforeAll(async () => {
  repository = new MemoryRepository();
  const project = await createProject(repository, { name: "Pets" });
  const contract = await createContract(repository, project.id, { name: "pets-api" });
  const baseline = await createContractVersion(repository, contract.id, {
    content: baselinePetJson,
    label: "v1",
  });
  const candidate = await createContractVersion(repository, contract.id, {
    content: candidatePetJson,
    label: "v2",
  });
  const comparison = await createComparison(repository, project.id, {
    baselineVersionId: baseline.id,
    candidateVersionId: candidate.id,
  });
  projectId = project.id;
  comparisonId = comparison.id;

  server = await startTestServer(
    createApp({ corsOrigins: ["http://localhost:3000"], repository }),
  );
});

afterAll(async () => {
  await server.close();
});

function api(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${server.baseUrl}/api/v1${path}`, init);
}

describe("source analysis routes", () => {
  it("reports GitHub configuration status without leaking credentials", async () => {
    const response = await api("/github/status");

    expect(response.status).toBe(200);
    const body = (await response.json()) as GitHubStatusResponse;
    expect(body).toEqual({ configured: false });
    expect(JSON.stringify(body)).not.toContain("token");
  });

  it("returns a clear 503 when GitHub is not configured", async () => {
    const response = await api(`/projects/${projectId}/source/github`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ repository: "octo/pets", analysisRunId: comparisonId }),
    });

    expect(response.status).toBe(503);
    const body = (await response.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("github_not_configured");
  });

  it("accepts a ZIP upload and returns persisted evidence", async () => {
    const form = new FormData();
    form.append("archive", new Blob([Buffer.from(buildZip())]), "source.zip");
    form.append("analysisRunId", comparisonId);

    const response = await api(`/projects/${projectId}/source/zip`, {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(201);
    const snapshot = (await response.json()) as SourceSnapshotDetailDto;
    expect(snapshot).toMatchObject({
      projectId,
      analysisRunId: comparisonId,
      sourceType: "zip",
      fileCount: 1,
      impactCount: 2,
    });
    expect(snapshot.impacts).toHaveLength(2);
    expect(snapshot.impacts.every((impact) => impact.evidence.includes("src/client.ts"))).toBe(
      true,
    );

    const listResponse = await api(`/projects/${projectId}/source`);
    expect(listResponse.status).toBe(200);
    const list = (await listResponse.json()) as ListSourceSnapshotsResponse;
    expect(list.snapshots.some((entry) => entry.id === snapshot.id)).toBe(true);

    const detailResponse = await api(`/source/${snapshot.id}`);
    expect(detailResponse.status).toBe(200);
    const detail = (await detailResponse.json()) as SourceSnapshotDetailDto;
    expect(detail.impacts.map((impact) => impact.id)).toEqual(
      snapshot.impacts.map((impact) => impact.id),
    );
  });

  it("requires an archive field", async () => {
    const response = await api(`/projects/${projectId}/source/zip`, {
      method: "POST",
      body: new FormData(),
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("archive_required");
  });

  it("rejects a non-ZIP upload", async () => {
    const form = new FormData();
    form.append("archive", new Blob([Buffer.from("not a zip")]), "source.zip");

    const response = await api(`/projects/${projectId}/source/zip`, {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("invalid_zip");
  });

  it("returns 404 for an unknown project", async () => {
    const form = new FormData();
    form.append("archive", new Blob([Buffer.from(buildZip())]), "source.zip");

    const response = await api("/projects/missing/source/zip", {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as ApiErrorResponse;
    expect(body.error.code).toBe("project_not_found");
  });
});
