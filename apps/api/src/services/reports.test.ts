import { describe, expect, it } from "vitest";
import { MemoryRepository } from "../db/memory-repository.js";
import { baselinePetJson, candidatePetJson } from "../testing/fixtures.js";
import { createComparison } from "./comparisons.js";
import { createContract, createContractVersion } from "./contracts.js";
import { createProject } from "./projects.js";
import { getComparisonReport, renderMarkdownReport } from "./reports.js";

async function seedComparison(repository: MemoryRepository) {
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
    label: "v1 → v2",
  });
  return { project, comparison };
}

async function seedSnapshot(repository: MemoryRepository, projectId: string, runId: string) {
  return repository.createSourceSnapshot({
    projectId,
    analysisRunId: runId,
    sourceType: "zip",
    fileCount: 1,
    skippedCount: 1,
    totalBytes: 42,
    limitations: ["Static analysis only detects statically resolvable calls."],
    files: [
      { path: "src/client.ts", bytes: 42, skipped: false },
      { path: "src/image.png", bytes: 0, skipped: true, reason: "Unsupported file type." },
    ],
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
}

describe("comparison reports", () => {
  it("builds a complete JSON report with the latest source analysis", async () => {
    const repository = new MemoryRepository();
    const { project, comparison } = await seedComparison(repository);
    const snapshot = await seedSnapshot(repository, project.id, comparison.id);
    const generatedAt = new Date("2026-04-05T06:07:08.000Z");

    const report = await getComparisonReport(repository, comparison.id, {
      now: generatedAt,
    });

    expect(report.schemaVersion).toBe("contract-ripple.report.v1");
    expect(report.generatedAt).toBe(generatedAt.toISOString());
    expect(report.project).toEqual({ id: project.id, name: "Pets" });
    expect(report.comparison.id).toBe(comparison.id);
    expect(report.comparison.label).toBe("v1 → v2");
    expect(report.findings).toEqual(comparison.findings);
    expect(report.regressionSuggestions).toEqual(comparison.regressionSuggestions);
    expect(report.regressionSuggestions.length).toBeGreaterThan(0);
    expect(report.sourceAnalysis).toMatchObject({
      availableSnapshotCount: 1,
      includedSnapshotId: snapshot.id,
    });
    expect(report.sourceAnalysis.snapshot?.impacts).toHaveLength(1);
    expect(report.sourceAnalysis.snapshot?.impacts[0]?.matchedPath).toBe("/pets");
    expect(report.sourceAnalysis.snapshot?.impacts[0]?.evidence).toContain("src/client.ts");
    expect(report.limitations.length).toBeGreaterThan(0);
    expect(report.notes.join(" ")).toContain("not generated executable tests");
  });

  it("includes only the latest attached source snapshot", async () => {
    const repository = new MemoryRepository();
    const { project, comparison } = await seedComparison(repository);
    const first = await seedSnapshot(repository, project.id, comparison.id);
    const second = await seedSnapshot(repository, project.id, comparison.id);

    const report = await getComparisonReport(repository, comparison.id);

    expect(first.id).not.toBe(second.id);
    expect(report.sourceAnalysis.availableSnapshotCount).toBe(2);
    expect(report.sourceAnalysis.includedSnapshotId).toBe(second.id);
    expect(report.sourceAnalysis.snapshot?.id).toBe(second.id);
  });

  it("reports when no source analysis is attached", async () => {
    const repository = new MemoryRepository();
    const { comparison } = await seedComparison(repository);

    const report = await getComparisonReport(repository, comparison.id);

    expect(report.sourceAnalysis).toEqual({
      availableSnapshotCount: 0,
      includedSnapshotId: null,
      snapshot: null,
    });
  });

  it("renders a readable Markdown report with suggestions, findings, and source evidence", async () => {
    const repository = new MemoryRepository();
    const { project, comparison } = await seedComparison(repository);
    await seedSnapshot(repository, project.id, comparison.id);
    const report = await getComparisonReport(repository, comparison.id);
    const markdown = renderMarkdownReport(report);

    expect(markdown).toContain("# ContractRipple analysis report");
    expect(markdown).toContain(`Project: Pets`);
    expect(markdown).toContain("## Regression suggestions");
    expect(markdown).toContain("## Source analysis");
    expect(markdown).toContain("src/client.ts:12:3");
    expect(markdown).toContain("## Findings");
    expect(markdown).toContain("POST /pets");
    expect(markdown).toContain("## Notes");
    expect(markdown.endsWith("\n")).toBe(true);
  });

  it("rejects an unknown comparison", async () => {
    const repository = new MemoryRepository();

    await expect(
      getComparisonReport(repository, "missing"),
    ).rejects.toMatchObject({ status: 404, code: "comparison_not_found" });
  });
});
