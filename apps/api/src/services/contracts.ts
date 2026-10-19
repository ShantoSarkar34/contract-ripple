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
import type { Repository } from "../db/types.js";
import { notFound } from "../middleware/http-error.js";
import {
  toContractDto,
  toVersionDetailDto,
  toVersionDto,
} from "./serialization.js";

function checksumOf(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export async function createContract(
  repository: Repository,
  projectId: string,
  input: CreateContractRequest,
): Promise<ContractDto> {
  const project = await repository.getProject(projectId);
  if (!project) {
    throw notFound("project_not_found", "Project not found.");
  }

  const record = await repository.createContract({ projectId, name: input.name });
  return toContractDto({ ...record, versionCount: 0 });
}

export async function listContracts(
  repository: Repository,
  projectId: string,
): Promise<ContractDto[]> {
  const project = await repository.getProject(projectId);
  if (!project) {
    throw notFound("project_not_found", "Project not found.");
  }

  const records = await repository.listContractsByProject(projectId);
  return records.map(toContractDto);
}

export async function getContract(
  repository: Repository,
  contractId: string,
): Promise<ContractDetailDto> {
  const contract = await repository.getContract(contractId);
  if (!contract) {
    throw notFound("contract_not_found", "Contract not found.");
  }

  const versions = await repository.listVersionsByContract(contractId);
  return { ...toContractDto(contract), versions: versions.map(toVersionDto) };
}

export async function createContractVersion(
  repository: Repository,
  contractId: string,
  input: CreateContractVersionRequest,
): Promise<ContractVersionDto> {
  const contract = await repository.getContract(contractId);
  if (!contract) {
    throw notFound("contract_not_found", "Contract not found.");
  }

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
  contractId: string,
): Promise<ContractVersionDto[]> {
  const contract = await repository.getContract(contractId);
  if (!contract) {
    throw notFound("contract_not_found", "Contract not found.");
  }

  const versions = await repository.listVersionsByContract(contractId);
  return versions.map(toVersionDto);
}

export async function getVersion(
  repository: Repository,
  versionId: string,
): Promise<ContractVersionDetailDto> {
  const version = await repository.getContractVersion(versionId);
  if (!version) {
    throw notFound("version_not_found", "Contract version not found.");
  }
  return toVersionDetailDto(version);
}
