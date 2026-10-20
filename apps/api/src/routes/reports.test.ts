import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type {
  AnalysisReportDto,
  AnalysisRunDetailDto,
  ApiErrorResponse,
  ListAnalysesResponse,
} from "@contract-ripple/shared";
import { createApp } from "../create-app.js";
import { MemoryRepository } from "../db/memory-repository.js";
import { createComparison } from "../services/comparisons.js";
import { createContract, createContractVersion } from "../services/contracts.js";
import { createProject } from "../services/projects.js";
import { baselinePetJson, candidatePetJson } from "../testing/fixtures.js";
import { startTestServer, type TestServer } from "../testing/http.js";

let server: TestServer;
let projectId: string;
let comparisonIds: string[] = [];
let latestComparisonId: string;

beforeAll(async () => {
  const repository = new MemoryRepository();
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

  for (let index = 0; index < 3; index += 1) {
    const comparison = await createComparison(repository, project.id, {
      baselineVersionId: baseline.id,
      candidateVersionId: candidate.id,
      label: `run ${index + 1}`,
    });
    comparisonIds.push(comparison.id);
  }

  projectId = project.id;
  latestComparisonId = comparisonIds[comparisonIds.length - 1] ?? "";

  await repository.createSourceSnapshot({
    projectId,
    analysisRunId: latestComparisonId,
    sourceType: "zip",
    fileCount: 1,
    skippedCount: 0,
    totalBytes: 42,
    limitations: ["Static analysis limits apply."],
    files: [{ path: "src/client.ts", bytes: 42, skipped: false }],
    impacts: [
      {
        filePath: "src/client.ts",
        line: 12,
        column: 3,
        snippet: "await api.post(`/pets`, body);",
        call: "api.post",
        method: "post",
        path: "/pets",
        matchedMethod: "post",
        matchedPath: "/pets",
        operationId: "createPet",
        confidence: "high",
        evidence: "api.post call at src/client.ts:12:3 matched POST /pets",
      },
    ],
  });

  server = await startTestServer(
    createApp({ corsOrigins: ["http://localhost:3000"], repository }),
  );
});

afterAll(async () => {
  await server.close();
});

function api(path: string): Promise<Response> {
  return fetch(`${server.baseUrl}/api/v1${path}`);
}

describe("saved history and report routes", () => {
  it("paginates saved comparisons and validates the cursor", async () => {
    const firstResponse = await api(`/projects/${projectId}/comparisons?limit=2`);
    expect(firstResponse.status).toBe(200);
    const first = (await firstResponse.json()) as ListAnalysesResponse;
    expect(first.analyses).toHaveLength(2);
    expect(first.totalCount).toBe(3);
    expect(first.nextCursor).toBe(first.analyses[1]?.id);

    const secondResponse = await api(
      `/projects/${projectId}/comparisons?limit=2&cursor=${encodeURIComponent(
        first.nextCursor ?? "",
      )}`,
    );
    expect(secondResponse.status).toBe(200);
    const second = (await secondResponse.json()) as ListAnalysesResponse;
    expect(second.analyses).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(second.totalCount).toBe(3);

    expect(
      new Set([...first.analyses, ...second.analyses].map((run) => run.id)).size,
    ).toBe(3);

    const invalidLimit = await api(`/projects/${projectId}/comparisons?limit=0`);
    expect(invalidLimit.status).toBe(400);
    expect(((await invalidLimit.json()) as ApiErrorResponse).error.code).toBe(
      "validation_error",
    );

    const invalidCursor = await api(
      `/projects/${projectId}/comparisons?cursor=missing`,
    );
    expect(invalidCursor.status).toBe(400);
    expect(((await invalidCursor.json()) as ApiErrorResponse).error.code).toBe(
      "invalid_cursor",
    );
  });

  it("returns a downloadable JSON report", async () => {
    const response = await api(`/comparisons/${latestComparisonId}/report`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(response.headers.get("cache-control")).toBe("no-store");

    const report = (await response.json()) as AnalysisReportDto;
    expect(report.schemaVersion).toBe("contract-ripple.report.v1");
    expect(report.project.name).toBe("Pets");
    expect(report.comparison.id).toBe(latestComparisonId);
    expect(report.findings.length).toBeGreaterThan(0);
    expect(report.regressionSuggestions.length).toBeGreaterThan(0);
    expect(report.sourceAnalysis.includedSnapshotId).not.toBeNull();
    expect(report.sourceAnalysis.snapshot?.impacts).toHaveLength(1);
  });

  it("returns a downloadable Markdown report", async () => {
    const response = await api(
      `/comparisons/${latestComparisonId}/report?format=markdown`,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(response.headers.get("content-disposition")).toContain(".md");
    const markdown = await response.text();
    expect(markdown).toContain("# ContractRipple analysis report");
    expect(markdown).toContain("## Regression suggestions");
    expect(markdown).toContain("## Source analysis");
    expect(markdown).toContain("## Findings");
  });

  it("rejects unsupported report formats and unknown comparisons", async () => {
    const formatResponse = await api(
      `/comparisons/${latestComparisonId}/report?format=html`,
    );
    expect(formatResponse.status).toBe(400);
    expect(((await formatResponse.json()) as ApiErrorResponse).error.code).toBe(
      "validation_error",
    );

    const missing = await api("/comparisons/missing/report");
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as ApiErrorResponse).error.code).toBe(
      "comparison_not_found",
    );
  });

  it("includes regression suggestions in comparison detail responses", async () => {
    const response = await api(`/comparisons/${latestComparisonId}`);
    expect(response.status).toBe(200);
    const detail = (await response.json()) as AnalysisRunDetailDto;
    expect(detail.regressionSuggestions.length).toBeGreaterThan(0);
    expect(detail.regressionSuggestions[0]?.findingIds.length).toBeGreaterThan(0);
  });
});
