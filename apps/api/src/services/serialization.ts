import type {
  AnalysisRunDetailDto,
  AnalysisRunDto,
  ContractDto,
  ContractSummaryDto,
  ContractVersionDetailDto,
  ContractVersionDto,
  FindingDto,
  ProjectDto,
} from "@contract-ripple/shared";
import type {
  AnalysisRunDetailRecord,
  AnalysisRunWithVersions,
  ContractRecordWithCount,
  ContractSummaryRecord,
  ContractVersionRecord,
  ContractVersionWithContract,
  FindingRecord,
  ProjectRecordWithCount,
} from "../db/types.js";
import { utf8ByteLength } from "@contract-ripple/shared";

export function toProjectDto(record: ProjectRecordWithCount): ProjectDto {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    contractCount: record.contractCount,
  };
}

export function toContractDto(record: ContractRecordWithCount): ContractDto {
  return {
    id: record.id,
    projectId: record.projectId,
    name: record.name,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    versionCount: record.versionCount,
  };
}

export function toVersionDto(record: ContractVersionRecord): ContractVersionDto {
  return {
    id: record.id,
    contractId: record.contractId,
    label: record.label,
    format: record.format,
    openapiVersion: record.openapiVersion,
    title: record.title,
    infoVersion: record.infoVersion,
    checksum: record.checksum,
    contentBytes: utf8ByteLength(record.rawContent),
    warnings: record.warnings,
    createdAt: record.createdAt.toISOString(),
  };
}

export function toVersionDetailDto(record: ContractVersionRecord): ContractVersionDetailDto {
  return { ...toVersionDto(record), content: record.rawContent };
}

export function toFindingDto(record: FindingRecord): FindingDto {
  return {
    id: record.engineId,
    category: record.category,
    changeType: record.changeType,
    risk: record.risk,
    path: record.path,
    method: record.method,
    operationId: record.operationId,
    location: record.location,
    summary: record.summary,
    explanation: record.explanation,
    before: record.before,
    after: record.after,
  };
}

function toContractSummaryDto(
  version: ContractVersionWithContract,
  summary: ContractSummaryRecord,
): ContractSummaryDto {
  return {
    openapi: summary.openapi,
    title: summary.title ?? version.title,
    version: summary.version ?? version.infoVersion,
    warnings: summary.warnings,
    contractId: version.contract.id,
    contractName: version.contract.name,
    versionId: version.id,
    versionLabel: version.label,
  };
}

export function toAnalysisRunDto(record: AnalysisRunWithVersions): AnalysisRunDto {
  return {
    id: record.id,
    projectId: record.projectId,
    label: record.label,
    status: record.status,
    truncated: record.truncated,
    totalFindings: record.totalFindings,
    nonBreakingCount: record.nonBreakingCount,
    potentiallyBreakingCount: record.potentiallyBreakingCount,
    unknownCount: record.unknownCount,
    durationMs: record.durationMs,
    createdAt: record.createdAt.toISOString(),
    baselineVersionId: record.baselineVersionId,
    candidateVersionId: record.candidateVersionId,
    baselineVersionLabel: record.baselineVersion.label,
    candidateVersionLabel: record.candidateVersion.label,
  };
}

export function toAnalysisRunDetailDto(record: AnalysisRunDetailRecord): AnalysisRunDetailDto {
  return {
    ...toAnalysisRunDto(record),
    baseline: toContractSummaryDto(record.baselineVersion, record.baselineSummary),
    candidate: toContractSummaryDto(record.candidateVersion, record.candidateSummary),
    limitations: record.limitations,
    findings: record.findings.map(toFindingDto),
  };
}
