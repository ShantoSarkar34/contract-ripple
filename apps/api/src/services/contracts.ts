import { createHash } from "node:crypto";
import {
  detectFormat,
  parseContractInput,
  validateContract,
} from "@contract-ripple/engine";
import type {
  ContractDetailDto,
  ContractDto,
  ContractVersionDetailDto,
  ContractVersionDto,
  CreateContractRequest,
  CreateContractVersionRequest,
} from "@contract-ripple/shared";
import type { ContractRecordWithCount, Repository } from "../db/types.js";
import { notFound } from "../middleware/http-error.js";
import { requireProject } from "./authorization.js";
import {
  toContractDto,
  toVersionDetailDto,
  toVersionDto,
} from "./serialization.js";

function checksumOf(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Resolves a contract only when its parent project belongs to the caller.
 * Another user's contract is reported as not found rather than forbidden so the
 * API does not confirm that an id exists.
 */
async function requireOwnedContract(
  repository: Repository,
  ownerId: string,
  contractId: string,
): Promise<ContractRecordWithCount> {
  const contract = await repository.getContract(contractId);
  if (!contract) {
    throw notFound("contract_not_found", "Contract not found.");
  }
  const project = await repository.getProject(contract.projectId);
  if (!project || project.ownerId !== ownerId) {
    throw notFound("contract_not_found", "Contract not found.");
  }
  return contract;
}

export async function createContract(
  repository: Repository,
  ownerId: string,
  projectId: string,
  input: CreateContractRequest,
): Promise<ContractDto> {
  await requireProject(repository, ownerId, projectId);

  const record = await repository.createContract({ projectId, name: input.name });
  return toContractDto({ ...record, versionCount: 0 });
}

export async function listContracts(
  repository: Repository,
  ownerId: string,
  projectId: string,
): Promise<ContractDto[]> {
  await requireProject(repository, ownerId, projectId);

  const records = await repository.listContractsByProject(projectId);
  return records.map(toContractDto);
}

export async function getContract(
  repository: Repository,
  ownerId: string,
  contractId: string,
): Promise<ContractDetailDto> {
  const contract = await requireOwnedContract(repository, ownerId, contractId);

  const versions = await repository.listVersionsByContract(contractId);
  return { ...toContractDto(contract), versions: versions.map(toVersionDto) };
}

export async function createContractVersion(
  repository: Repository,
  ownerId: string,
  contractId: string,
  input: CreateContractVersionRequest,
): Promise<ContractVersionDto> {
  await requireOwnedContract(repository, ownerId, contractId);

  const format = input.format ?? detectFormat(input.content);
  const parsed = parseContractInput({ content: input.content, format }, "contract");
  const summary = await validateContract(parsed, "contract");

  const record = await repository.createContractVersion({
    contractId,
    label: input.label,
    format,
    rawContent: input.content,
    checksum: checksumOf(input.content),
    openapiVersion: summary.openapi,
    title: summary.title,
    infoVersion: summary.version,
    warnings: summary.warnings,
  });

  return toVersionDto(record);
}

export async function listVersions(
  repository: Repository,
  ownerId: string,
  contractId: string,
): Promise<ContractVersionDto[]> {
  await requireOwnedContract(repository, ownerId, contractId);

  const versions = await repository.listVersionsByContract(contractId);
  return versions.map(toVersionDto);
}

export async function getVersion(
  repository: Repository,
  ownerId: string,
  versionId: string,
): Promise<ContractVersionDetailDto> {
  const version = await repository.getContractVersion(versionId);
  if (!version) {
    throw notFound("version_not_found", "Contract version not found.");
  }

  const project = await repository.getProject(version.contract.projectId);
  if (!project || project.ownerId !== ownerId) {
    throw notFound("version_not_found", "Contract version not found.");
  }

  return toVersionDetailDto(version);
}
