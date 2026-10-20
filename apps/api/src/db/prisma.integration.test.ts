import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { config as loadDotenv } from "dotenv";
import { strToU8, zipSync } from "fflate";
import type { PrismaClient } from "@prisma/client";
import { PrismaRepository } from "./prisma-repository.js";
import { createProject } from "../services/projects.js";
import { createContract, createContractVersion } from "../services/contracts.js";
import { createComparison, getComparison, listComparisons } from "../services/comparisons.js";
import {
  analyzeZipSource,
  getSourceSnapshot,
  listSourceSnapshots,
} from "../services/source.js";
import { baselinePetJson, candidatePetJson } from "../testing/fixtures.js";

// The API's .env lives two directories above this file (apps/api/.env).
loadDotenv({ path: new URL("../../.env", import.meta.url), quiet: true });

const shouldRun =
  process.env.RUN_DB_TESTS === "1" && typeof process.env.DATABASE_URL === "string";

/**
 * Real-database integration test. Skipped unless `RUN_DB_TESTS=1` is set, so the
 * default unit suite stays independent of a running PostgreSQL instance.
 *
 * Run with: RUN_DB_TESTS=1 npx vitest run apps/api/src/db
 */
describe.skipIf(!shouldRun)("PrismaRepository (integration)", () => {
  let prisma: PrismaClient;
  let repository: PrismaRepository;
  let projectId: string | undefined;

  beforeAll(async () => {
    const { PrismaClient: PrismaClientConstructor } = await import("@prisma/client");
    prisma = new PrismaClientConstructor();
    await prisma.$connect();
    repository = new PrismaRepository(prisma);
  });

  afterAll(async () => {
    if (projectId) {
      await prisma.project.delete({ where: { id: projectId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("persists and reads back a full comparison against PostgreSQL", async () => {
    await repository.ping();

    const project = await createProject(repository, {
      name: `integration-${Date.now()}`,
      description: "Created by the phase 3 integration test",
    });
    projectId = project.id;

    const contract = await createContract(repository, project.id, { name: "pets-api" });

    const baseline = await createContractVersion(repository, contract.id, {
      content: baselinePetJson,
      label: "v1",
    });
    const candidate = await createContractVersion(repository, contract.id, {
      content: candidatePetJson,
      label: "v2",
    });

    const created = await createComparison(repository, project.id, {
      baselineVersionId: baseline.id,
      candidateVersionId: candidate.id,
      label: "v1 → v2",
    });

    expect(created.findings.length).toBe(created.totalFindings);
    expect(created.findings.length).toBeGreaterThan(0);
    expect(created.baseline.contractName).toBe("pets-api");

    const stored = await getComparison(repository, created.id);
    expect(stored.id).toBe(created.id);
    expect(stored.findings.map((finding) => finding.id)).toEqual(
      created.findings.map((finding) => finding.id),
    );
    expect(stored.limitations.length).toBeGreaterThan(0);

    const runs = await listComparisons(repository, project.id);
    expect(runs.map((run) => run.id)).toContain(created.id);

    const projects = await repository.listProjects();
    const storedProject = projects.find((entry) => entry.id === project.id);
    expect(storedProject?.contractCount).toBe(1);

    const archive = zipSync({
      "src/client.ts": strToU8(`
        fetch("/pets", { method: "POST" });
        axios.get("/pets");
      `),
    });
    const snapshot = await analyzeZipSource(repository, project.id, archive, {
      analysisRunId: created.id,
    });
    expect(snapshot.impactCount).toBe(2);
    expect(snapshot.files).toHaveLength(1);

    const storedSnapshot = await getSourceSnapshot(repository, snapshot.id);
    expect(storedSnapshot.impacts.map((impact) => impact.evidence)).toEqual(
      snapshot.impacts.map((impact) => impact.evidence),
    );

    const snapshots = await listSourceSnapshots(repository, project.id);
    expect(snapshots.snapshots.map((entry) => entry.id)).toContain(snapshot.id);
  }, 30_000);
});
