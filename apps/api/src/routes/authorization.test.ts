import { strToU8, zipSync } from "fflate";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ApiErrorResponse, ListProjectsResponse } from "@contract-ripple/shared";
import { createApp } from "../create-app.js";
import { MemoryRepository } from "../db/memory-repository.js";
import { createComparison } from "../services/comparisons.js";
import { createContract, createContractVersion } from "../services/contracts.js";
import { createProject } from "../services/projects.js";
import { analyzeZipSource } from "../services/source.js";
import {
  registerTestUser,
  TEST_AUTH_SECRET,
  withSession,
  type TestSession,
} from "../testing/auth.js";
import { baselinePetJson, candidatePetJson } from "../testing/fixtures.js";
import { startTestServer, type TestServer } from "../testing/http.js";

let server: TestServer;
let owner: TestSession;
let intruder: TestSession;
let projectId: string;
let contractId: string;
let versionId: string;
let comparisonId: string;
let snapshotId: string;

function api(session: TestSession, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${server.baseUrl}/api/v1${path}`, withSession(session, init));
}

async function errorCode(response: Response): Promise<string> {
  return ((await response.json()) as ApiErrorResponse).error.code;
}

beforeAll(async () => {
  const repository = new MemoryRepository();
  server = await startTestServer(
    createApp({
      corsOrigins: ["http://localhost:3000"],
      repository,
      authSecret: TEST_AUTH_SECRET,
      nodeEnv: "test",
      trustProxy: false,
    }),
  );

  owner = await registerTestUser(server.baseUrl, "owner@example.test");
  intruder = await registerTestUser(server.baseUrl, "intruder@example.test");

  const project = await createProject(repository, owner.user.id, { name: "Owner project" });
  const contract = await createContract(repository, owner.user.id, project.id, {
    name: "owner-api",
  });
  const baseline = await createContractVersion(repository, owner.user.id, contract.id, {
    content: baselinePetJson,
    label: "v1",
  });
  const candidate = await createContractVersion(repository, owner.user.id, contract.id, {
    content: candidatePetJson,
    label: "v2",
  });
  const comparison = await createComparison(repository, owner.user.id, project.id, {
    baselineVersionId: baseline.id,
    candidateVersionId: candidate.id,
  });
  const snapshot = await analyzeZipSource(
    repository,
    owner.user.id,
    project.id,
    zipSync({ "src/client.ts": strToU8(`fetch("/pets", { method: "POST" });\n`) }),
    { analysisRunId: comparison.id },
  );

  projectId = project.id;
  contractId = contract.id;
  versionId = baseline.id;
  comparisonId = comparison.id;
  snapshotId = snapshot.id;
});

afterAll(async () => {
  await server.close();
});

describe("server-side ownership (IDOR)", () => {
  it("does not list another user's projects", async () => {
    const response = await api(intruder, "/projects");
    expect(response.status).toBe(200);
    const body = (await response.json()) as ListProjectsResponse;
    expect(body.projects.map((entry) => entry.id)).not.toContain(projectId);
  });

  it("hides projects and their nested resources from another user", async () => {
    expect((await api(intruder, `/projects/${projectId}`)).status).toBe(404);
    expect(
      (
        await api(intruder, `/projects/${projectId}`, {
          method: "PATCH",
          body: JSON.stringify({ name: "Hijacked" }),
        })
      ).status,
    ).toBe(404);
    expect((await api(intruder, `/projects/${projectId}/contracts`)).status).toBe(404);
    expect(
      (
        await api(intruder, `/projects/${projectId}/contracts`, {
          method: "POST",
          body: JSON.stringify({ name: "intruder-api" }),
        })
      ).status,
    ).toBe(404);
    expect((await api(intruder, `/projects/${projectId}/comparisons`)).status).toBe(404);
    expect(
      (
        await api(intruder, `/projects/${projectId}/comparisons`, {
          method: "POST",
          body: JSON.stringify({
            baselineVersionId: versionId,
            candidateVersionId: versionId,
          }),
        })
      ).status,
    ).toBe(404);
    expect((await api(intruder, `/projects/${projectId}/source`)).status).toBe(404);
  });

  it("hides contracts and versions from another user", async () => {
    expect((await api(intruder, `/contracts/${contractId}`)).status).toBe(404);
    expect((await api(intruder, `/contracts/${contractId}/versions`)).status).toBe(404);
    expect(
      (
        await api(intruder, `/contracts/${contractId}/versions`, {
          method: "POST",
          body: JSON.stringify({ content: baselinePetJson }),
        })
      ).status,
    ).toBe(404);
    expect((await api(intruder, `/versions/${versionId}`)).status).toBe(404);
  });

  it("hides comparisons and reports from another user", async () => {
    const comparison = await api(intruder, `/comparisons/${comparisonId}`);
    expect(comparison.status).toBe(404);
    expect(await errorCode(comparison)).toBe("comparison_not_found");

    const report = await api(intruder, `/comparisons/${comparisonId}/report`);
    expect(report.status).toBe(404);
    expect(await errorCode(report)).toBe("comparison_not_found");
  });

  it("hides source snapshots from another user", async () => {
    const snapshot = await api(intruder, `/source/${snapshotId}`);
    expect(snapshot.status).toBe(404);
    expect(await errorCode(snapshot)).toBe("source_snapshot_not_found");
  });

  it("rejects source upload into another user's project", async () => {
    const form = new FormData();
    form.append("archive", new Blob([Buffer.from(zipSync({ "src/a.ts": strToU8("fetch('/x')") }))]), "source.zip");

    const response = await api(intruder, `/projects/${projectId}/source/zip`, {
      method: "POST",
      body: form,
    });
    expect(response.status).toBe(404);
    expect(await errorCode(response)).toBe("project_not_found");
  });

  it("still lets the owner read every resource", async () => {
    expect((await api(owner, `/projects/${projectId}`)).status).toBe(200);
    expect((await api(owner, `/contracts/${contractId}`)).status).toBe(200);
    expect((await api(owner, `/versions/${versionId}`)).status).toBe(200);
    expect((await api(owner, `/comparisons/${comparisonId}`)).status).toBe(200);
    expect((await api(owner, `/comparisons/${comparisonId}/report`)).status).toBe(200);
    expect((await api(owner, `/source/${snapshotId}`)).status).toBe(200);
    expect((await api(owner, `/projects/${projectId}/source`)).status).toBe(200);
  });

  it("requires authentication for every data route", async () => {
    for (const path of [
      "/projects",
      `/projects/${projectId}`,
      `/contracts/${contractId}`,
      `/versions/${versionId}`,
      `/comparisons/${comparisonId}`,
      `/comparisons/${comparisonId}/report`,
      `/source/${snapshotId}`,
    ]) {
      const response = await fetch(`${server.baseUrl}/api/v1${path}`);
      expect(response.status).toBe(401);
    }
  });
});
