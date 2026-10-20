import { describe, expect, it } from "vitest";
import { MemoryRepository } from "../db/memory-repository.js";
import { baselinePetJson, candidatePetJson } from "../testing/fixtures.js";
import { createComparison, getComparison, listComparisons } from "./comparisons.js";
import { createContract, createContractVersion } from "./contracts.js";
import { createProject } from "./projects.js";

async function seedVersions(repository: MemoryRepository, projectId: string, contractId: string) {
  const baseline = await createContractVersion(repository, contractId, {
    content: baselinePetJson,
    label: "v1",
  });
  const candidate = await createContractVersion(repository, contractId, {
    content: candidatePetJson,
    label: "v2",
  });
  return { projectId, baseline, candidate };
}

describe("comparison services", () => {
  it("runs the engine and persists findings with consistent summary counts", async () => {
    const repository = new MemoryRepository();
    const project = await createProject(repository, { name: "Pets" });
    const contract = await createContract(repository, project.id, { name: "pets-api" });
    const { baseline, candidate } = await seedVersions(repository, project.id, contract.id);

    const result = await createComparison(repository, project.id, {
      baselineVersionId: baseline.id,
      candidateVersionId: candidate.id,
      label: "v1 → v2",
    });

    expect(result.totalFindings).toBeGreaterThan(0);
    expect(result.findings).toHaveLength(result.totalFindings);
    expect(result.nonBreakingCount).toBe(
      result.findings.filter((finding) => finding.risk === "non_breaking").length,
    );
    expect(result.potentiallyBreakingCount).toBe(
      result.findings.filter((finding) => finding.risk === "potentially_breaking").length,
    );
    expect(result.unknownCount).toBe(
      result.findings.filter((finding) => finding.risk === "unknown").length,
    );
    expect(result.limitations.length).toBeGreaterThan(0);
  });

  it("classifies a removed operation as potentially breaking with evidence", async () => {
    const repository = new MemoryRepository();
    const project = await createProject(repository, { name: "Pets" });
    const contract = await createContract(repository, project.id, { name: "pets-api" });
    const { baseline, candidate } = await seedVersions(repository, project.id, contract.id);

    const result = await createComparison(repository, project.id, {
      baselineVersionId: baseline.id,
      candidateVersionId: candidate.id,
    });

    const removedPost = result.findings.find(
      (finding) =>
        finding.changeType === "removed" &&
        finding.category === "operation" &&
        finding.path === "/pets" &&
        finding.method?.toLowerCase() === "post",
    );

    expect(removedPost).toBeDefined();
    expect(removedPost?.risk).toBe("potentially_breaking");
    expect(removedPost?.summary.length).toBeGreaterThan(0);
    expect(removedPost?.explanation.length).toBeGreaterThan(0);
    expect(removedPost?.location.startsWith("#/")).toBe(true);

    const nonBreaking = result.findings.filter((finding) => finding.risk === "non_breaking");
    expect(nonBreaking.length).toBeGreaterThan(0);
  });

  it("keeps findings in the same order when read back from storage", async () => {
    const repository = new MemoryRepository();
    const project = await createProject(repository, { name: "Pets" });
    const contract = await createContract(repository, project.id, { name: "pets-api" });
    const { baseline, candidate } = await seedVersions(repository, project.id, contract.id);

    const created = await createComparison(repository, project.id, {
      baselineVersionId: baseline.id,
      candidateVersionId: candidate.id,
    });
    const stored = await getComparison(repository, created.id);

    expect(stored.id).toBe(created.id);
    expect(stored.findings.map((finding) => finding.id)).toEqual(
      created.findings.map((finding) => finding.id),
    );
    expect(stored.baseline.contractName).toBe("pets-api");
    expect(stored.baseline.versionLabel).toBe("v1");
    expect(stored.candidate.versionLabel).toBe("v2");
  });

  it("lists stored comparisons for a project", async () => {
    const repository = new MemoryRepository();
    const project = await createProject(repository, { name: "Pets" });
    const contract = await createContract(repository, project.id, { name: "pets-api" });
    const { baseline, candidate } = await seedVersions(repository, project.id, contract.id);
    await createComparison(repository, project.id, {
      baselineVersionId: baseline.id,
      candidateVersionId: candidate.id,
    });

    const page = await listComparisons(repository, project.id);

    expect(page.analyses).toHaveLength(1);
    expect(page.analyses[0]?.baselineVersionLabel).toBe("v1");
    expect(page.analyses[0]?.candidateVersionLabel).toBe("v2");
    expect(page.nextCursor).toBeNull();
    expect(page.totalCount).toBe(1);
  });

  it("paginates saved comparisons with a stable cursor", async () => {
    const repository = new MemoryRepository();
    const project = await createProject(repository, { name: "Pets" });
    const contract = await createContract(repository, project.id, { name: "pets-api" });
    const { baseline, candidate } = await seedVersions(repository, project.id, contract.id);

    const created = [];
    for (let index = 0; index < 3; index += 1) {
      created.push(
        await createComparison(repository, project.id, {
          baselineVersionId: baseline.id,
          candidateVersionId: candidate.id,
          label: `run ${index + 1}`,
        }),
      );
    }

    const first = await listComparisons(repository, project.id, { limit: 2 });
    expect(first.analyses).toHaveLength(2);
    expect(first.totalCount).toBe(3);
    expect(first.nextCursor).toBe(first.analyses[1]?.id);

    const second = await listComparisons(repository, project.id, {
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    });
    expect(second.analyses).toHaveLength(1);
    expect(second.nextCursor).toBeNull();
    expect(second.totalCount).toBe(3);

    expect(
      new Set([...first.analyses, ...second.analyses].map((run) => run.id)).size,
    ).toBe(3);
    expect([...first.analyses, ...second.analyses].map((run) => run.id)).toEqual(
      [...created].reverse().map((run) => run.id),
    );
  });

  it("rejects a cursor from another project", async () => {
    const repository = new MemoryRepository();
    const first = await createProject(repository, { name: "First" });
    const firstContract = await createContract(repository, first.id, { name: "first-api" });
    const firstVersions = await seedVersions(repository, first.id, firstContract.id);
    const firstRun = await createComparison(repository, first.id, {
      baselineVersionId: firstVersions.baseline.id,
      candidateVersionId: firstVersions.candidate.id,
    });

    const second = await createProject(repository, { name: "Second" });

    await expect(
      listComparisons(repository, second.id, { limit: 20, cursor: firstRun.id }),
    ).rejects.toMatchObject({ status: 400, code: "invalid_cursor" });
  });

  it("derives deterministic regression suggestions from persisted findings", async () => {
    const repository = new MemoryRepository();
    const project = await createProject(repository, { name: "Pets" });
    const contract = await createContract(repository, project.id, { name: "pets-api" });
    const { baseline, candidate } = await seedVersions(repository, project.id, contract.id);

    const created = await createComparison(repository, project.id, {
      baselineVersionId: baseline.id,
      candidateVersionId: candidate.id,
    });
    const stored = await getComparison(repository, created.id);

    expect(created.regressionSuggestions.length).toBeGreaterThan(0);
    expect(stored.regressionSuggestions).toEqual(created.regressionSuggestions);

    const findingIds = new Set(created.findings.map((finding) => finding.id));
    for (const suggestion of created.regressionSuggestions) {
      expect(suggestion.findingIds.length).toBeGreaterThan(0);
      expect(suggestion.suggestedChecks.length).toBeGreaterThan(0);
      expect(suggestion.evidence.length).toBeGreaterThan(0);
      expect(suggestion.findingIds.every((findingId) => findingIds.has(findingId))).toBe(
        true,
      );
    }

    const postSuggestion = created.regressionSuggestions.find(
      (suggestion) => suggestion.method === "post" && suggestion.path === "/pets",
    );
    expect(postSuggestion).toBeDefined();
    expect(postSuggestion?.risk).toBe("potentially_breaking");
    expect(postSuggestion?.operationId).toBe("createPet");
  });

  it("rejects versions from a different project", async () => {
    const repository = new MemoryRepository();
    const projectA = await createProject(repository, { name: "A" });
    const projectB = await createProject(repository, { name: "B" });
    const contractA = await createContract(repository, projectA.id, { name: "a-api" });
    const contractB = await createContract(repository, projectB.id, { name: "b-api" });
    const baseline = await createContractVersion(repository, contractA.id, {
      content: baselinePetJson,
    });
    const candidate = await createContractVersion(repository, contractB.id, {
      content: candidatePetJson,
    });

    await expect(
      createComparison(repository, projectA.id, {
        baselineVersionId: baseline.id,
        candidateVersionId: candidate.id,
      }),
    ).rejects.toMatchObject({ status: 400, code: "version_project_mismatch" });
  });

  it("rejects an unknown baseline version with a 404", async () => {
    const repository = new MemoryRepository();
    const project = await createProject(repository, { name: "Pets" });

    await expect(
      createComparison(repository, project.id, {
        baselineVersionId: "missing",
        candidateVersionId: "missing",
      }),
    ).rejects.toMatchObject({ status: 404, code: "baseline_version_not_found" });
  });
});
