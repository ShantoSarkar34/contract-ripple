import { describe, expect, it } from "vitest";
import { EngineError } from "@contract-ripple/engine";
import { MemoryRepository } from "../db/memory-repository.js";
import {
  baselinePetJson,
  baselinePetYaml,
  invalidOpenApiJson,
  malformedContent,
} from "../testing/fixtures.js";
import {
  createContract,
  createContractVersion,
  getContract,
  getVersion,
  listContracts,
  listVersions,
} from "./contracts.js";
import { createProject } from "./projects.js";

async function seedContract(): Promise<{ repository: MemoryRepository; contractId: string }> {
  const repository = new MemoryRepository();
  const project = await createProject(repository, { name: "Pets" });
  const contract = await createContract(repository, project.id, { name: "pets-api" });
  return { repository, contractId: contract.id };
}

describe("contract services", () => {
  it("creates a contract inside an existing project", async () => {
    const repository = new MemoryRepository();
    const project = await createProject(repository, { name: "Pets" });

    const contract = await createContract(repository, project.id, { name: "pets-api" });

    expect(contract.projectId).toBe(project.id);
    expect(contract.name).toBe("pets-api");
    expect(contract.versionCount).toBe(0);
  });

  it("rejects a contract for an unknown project", async () => {
    const repository = new MemoryRepository();

    await expect(createContract(repository, "missing", { name: "pets" })).rejects.toMatchObject({
      status: 404,
      code: "project_not_found",
    });
  });

  it("uploads a validated JSON version with parsed metadata", async () => {
    const { repository, contractId } = await seedContract();

    const version = await createContractVersion(repository, contractId, {
      content: baselinePetJson,
      format: "json",
      label: "v1",
    });

    expect(version.format).toBe("json");
    expect(version.openapiVersion).toBe("3.0.3");
    expect(version.title).toBe("Pets API");
    expect(version.infoVersion).toBe("1.0.0");
    expect(version.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(version.contentBytes).toBeGreaterThan(0);
  });

  it("detects YAML when no format is provided", async () => {
    const { repository, contractId } = await seedContract();

    const version = await createContractVersion(repository, contractId, {
      content: baselinePetYaml,
    });

    expect(version.format).toBe("yaml");
    expect(version.openapiVersion).toBe("3.0.3");
  });

  it("rejects a document that is valid JSON but not OpenAPI", async () => {
    const { repository, contractId } = await seedContract();

    await expect(
      createContractVersion(repository, contractId, { content: invalidOpenApiJson }),
    ).rejects.toBeInstanceOf(EngineError);
  });

  it("rejects malformed content", async () => {
    const { repository, contractId } = await seedContract();

    await expect(
      createContractVersion(repository, contractId, { content: malformedContent }),
    ).rejects.toBeInstanceOf(EngineError);
  });

  it("lists contracts and versions in insertion order", async () => {
    const { repository, contractId } = await seedContract();
    await createContractVersion(repository, contractId, { content: baselinePetJson, label: "v1" });
    await createContractVersion(repository, contractId, { content: baselinePetYaml, label: "v2" });

    const project = await repository.getProject((await repository.getContract(contractId))!.projectId);
    const contracts = await listContracts(repository, project!.id);
    const versions = await listVersions(repository, contractId);

    expect(contracts).toHaveLength(1);
    expect(contracts[0]?.versionCount).toBe(2);
    expect(versions.map((version) => version.label)).toEqual(["v1", "v2"]);
  });

  it("returns a contract with its versions and a version with its raw content", async () => {
    const { repository, contractId } = await seedContract();
    const created = await createContractVersion(repository, contractId, {
      content: baselinePetJson,
    });

    const contract = await getContract(repository, contractId);
    const version = await getVersion(repository, created.id);

    expect(contract.versions).toHaveLength(1);
    expect(version.content).toBe(baselinePetJson);
  });
});
