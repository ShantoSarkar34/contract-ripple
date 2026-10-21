import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { MemoryRepository } from "../db/memory-repository.js";
import { TEST_OWNER_ID } from "../testing/auth.js";
import { baselinePetJson, candidatePetJson } from "../testing/fixtures.js";
import type { GitHubFetch } from "./github.js";
import { createComparison } from "./comparisons.js";
import { createContract, createContractVersion } from "./contracts.js";
import { createProject } from "./projects.js";
import {
  analyzeGitHubSource,
  analyzeZipSource,
  getGitHubStatus,
  getSourceSnapshot,
  listSourceSnapshots,
} from "./source.js";

const CLIENT_SOURCE = `
export async function createPet(body: unknown) {
  await fetch("/pets", { method: "POST", body: JSON.stringify(body) });
}

export async function listPets() {
  return axios.get("/pets");
}

export async function unrelated() {
  return fetch("/owners");
}
`;

async function seedComparison(repository: MemoryRepository, ownerId = TEST_OWNER_ID) {
  const project = await createProject(repository, ownerId, { name: "Pets" });
  const contract = await createContract(repository, ownerId, project.id, { name: "pets-api" });
  const baseline = await createContractVersion(repository, ownerId, contract.id, {
    content: baselinePetJson,
    label: "v1",
  });
  const candidate = await createContractVersion(repository, ownerId, contract.id, {
    content: candidatePetJson,
    label: "v2",
  });
  const comparison = await createComparison(repository, ownerId, project.id, {
    baselineVersionId: baseline.id,
    candidateVersionId: candidate.id,
  });
  return { project, contract, comparison };
}

function buildSourceZip(entries: Record<string, string> = { "src/client.ts": CLIENT_SOURCE }) {
  return zipSync(
    Object.fromEntries(
      Object.entries(entries).map(([path, content]) => [path, strToU8(content)]),
    ),
  );
}

function createGitHubFetch(): GitHubFetch {
  const base = "https://api.github.test/repos/octo/pets";
  return async (url) => {
    if (url === base) {
      return Response.json({ default_branch: "main" });
    }
    if (url === `${base}/commits/main`) {
      return Response.json({ sha: "commit-1" });
    }
    if (url === `${base}/git/trees/commit-1?recursive=1`) {
      return Response.json({
        tree: [{ path: "src/client.ts", type: "blob", size: 42, sha: "blob-1" }],
      });
    }
    if (url === `${base}/git/blobs/blob-1`) {
      return Response.json({
        content: Buffer.from(CLIENT_SOURCE, "utf8").toString("base64"),
        encoding: "base64",
      });
    }
    return Response.json({ message: "not found" }, { status: 404 });
  };
}

describe("source analysis services", () => {
  it("analyzes a ZIP archive and persists matched evidence", async () => {
    const repository = new MemoryRepository();
    const { project, comparison } = await seedComparison(repository);

    const snapshot = await analyzeZipSource(
      repository,
      TEST_OWNER_ID,
      project.id,
      buildSourceZip(),
      { analysisRunId: comparison.id },
    );

    expect(snapshot).toMatchObject({
      projectId: project.id,
      analysisRunId: comparison.id,
      sourceType: "zip",
      fileCount: 1,
      impactCount: 2,
      repository: null,
      ref: null,
    });
    expect(snapshot.impacts.map((impact) => impact.matchedMethod).sort()).toEqual([
      "get",
      "post",
    ]);
    expect(snapshot.impacts.every((impact) => impact.filePath === "src/client.ts")).toBe(true);
    expect(snapshot.impacts.every((impact) => impact.snippet.length > 0)).toBe(true);
    expect(snapshot.files).toContainEqual({
      path: "src/client.ts",
      bytes: Buffer.byteLength(CLIENT_SOURCE, "utf8"),
      skipped: false,
      reason: null,
    });
    expect(snapshot.limitations.join(" ")).toContain("Static analysis only detects");

    const stored = await getSourceSnapshot(repository, TEST_OWNER_ID, snapshot.id);
    expect(stored.impacts.map((impact) => impact.id)).toEqual(
      snapshot.impacts.map((impact) => impact.id),
    );
  });

  it("uses the latest comparison when an analysis id is not provided", async () => {
    const repository = new MemoryRepository();
    const { project, comparison } = await seedComparison(repository);

    const snapshot = await analyzeZipSource(repository, TEST_OWNER_ID, project.id, buildSourceZip(), {});

    expect(snapshot.analysisRunId).toBe(comparison.id);
  });

  it("lists source snapshots for a project", async () => {
    const repository = new MemoryRepository();
    const { project, comparison } = await seedComparison(repository);

    await analyzeZipSource(repository, TEST_OWNER_ID, project.id, buildSourceZip(), {
      analysisRunId: comparison.id,
    });
    await analyzeZipSource(repository, TEST_OWNER_ID, project.id, buildSourceZip(), {
      analysisRunId: comparison.id,
    });

    const { snapshots } = await listSourceSnapshots(repository, TEST_OWNER_ID, project.id);

    expect(snapshots).toHaveLength(2);
    expect(snapshots[0]?.impactCount).toBe(2);
    expect(snapshots[1]?.impactCount).toBe(2);
  });

  it("requires a comparison before source analysis", async () => {
    const repository = new MemoryRepository();
    const project = await createProject(repository, TEST_OWNER_ID, { name: "No comparisons" });

    await expect(
      analyzeZipSource(repository, TEST_OWNER_ID, project.id, buildSourceZip(), {}),
    ).rejects.toMatchObject({ status: 400, code: "no_comparison" });
  });

  it("rejects a comparison from another project", async () => {
    const repository = new MemoryRepository();
    const first = await seedComparison(repository);
    const otherProject = await createProject(repository, TEST_OWNER_ID, { name: "Other" });

    await expect(
      analyzeZipSource(repository, TEST_OWNER_ID, otherProject.id, buildSourceZip(), {
        analysisRunId: first.comparison.id,
      }),
    ).rejects.toMatchObject({ status: 400, code: "comparison_project_mismatch" });
  });

  it("rejects an unknown project", async () => {
    const repository = new MemoryRepository();

    await expect(
      analyzeZipSource(repository, TEST_OWNER_ID, "missing", buildSourceZip(), {}),
    ).rejects.toMatchObject({ status: 404, code: "project_not_found" });
  });

  it("does not analyze source or read snapshots for another owner", async () => {
    const repository = new MemoryRepository();
    const { project, comparison } = await seedComparison(repository, "someone-else");

    await expect(
      analyzeZipSource(repository, TEST_OWNER_ID, project.id, buildSourceZip(), {
        analysisRunId: comparison.id,
      }),
    ).rejects.toMatchObject({ status: 404, code: "project_not_found" });

    await expect(
      listSourceSnapshots(repository, TEST_OWNER_ID, project.id),
    ).rejects.toMatchObject({ status: 404, code: "project_not_found" });
  });

  it("maps unsafe archives to a 400 without persisting anything", async () => {
    const repository = new MemoryRepository();
    const { project, comparison } = await seedComparison(repository);
    const unsafe = zipSync({ "../evil.ts": strToU8(`fetch("/pets");`) });

    await expect(
      analyzeZipSource(repository, TEST_OWNER_ID, project.id, unsafe, {
        analysisRunId: comparison.id,
      }),
    ).rejects.toMatchObject({ status: 400, code: "unsafe_path" });

    const { snapshots } = await listSourceSnapshots(repository, TEST_OWNER_ID, project.id);
    expect(snapshots).toHaveLength(0);
  });

  it("rejects archives without supported source files", async () => {
    const repository = new MemoryRepository();
    const { project, comparison } = await seedComparison(repository);

    await expect(
      analyzeZipSource(
        repository,
        TEST_OWNER_ID,
        project.id,
        buildSourceZip({ "README.md": "# no source" }),
        { analysisRunId: comparison.id },
      ),
    ).rejects.toMatchObject({ status: 400, code: "no_supported_source" });
  });

  it("analyzes a GitHub repository through the official API client", async () => {
    const repository = new MemoryRepository();
    const { project, comparison } = await seedComparison(repository);

    const snapshot = await analyzeGitHubSource(
      repository,
      TEST_OWNER_ID,
      project.id,
      { repository: "octo/pets", analysisRunId: comparison.id },
      {
        githubToken: "test-token",
        githubApiBaseUrl: "https://api.github.test",
        githubFetch: createGitHubFetch(),
      },
    );

    expect(snapshot).toMatchObject({
      sourceType: "github",
      repository: "octo/pets",
      ref: "main",
      impactCount: 2,
    });
  });

  it("fails honestly when GitHub is not configured", async () => {
    const repository = new MemoryRepository();
    const { project, comparison } = await seedComparison(repository);

    await expect(
      analyzeGitHubSource(
        repository,
        TEST_OWNER_ID,
        project.id,
        { repository: "octo/pets", analysisRunId: comparison.id },
        { githubToken: "" },
      ),
    ).rejects.toMatchObject({ status: 503, code: "github_not_configured" });

    expect(getGitHubStatus({ githubToken: "" })).toEqual({ configured: false });
    expect(getGitHubStatus({ githubToken: "token" })).toEqual({ configured: true });
  });
});
