import type {
  AnalysisStatus,
  ChangeType,
  ContractFormat,
  FindingCategory,
  RiskLevel,
} from "@contract-ripple/shared";

/** A contract summary as produced by the engine and stored with an analysis run. */
export type ContractSummaryRecord = {
  openapi: string;
  title?: string;
  version?: string;
  warnings: string[];
};

export type ProjectRecord = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ProjectRecordWithCount = ProjectRecord & { contractCount: number };

export type ContractRecord = {
  id: string;
  projectId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ContractRecordWithCount = ContractRecord & { versionCount: number };

export type ContractVersionRecord = {
  id: string;
  contractId: string;
  label: string | null;
  format: ContractFormat;
  rawContent: string;
  checksum: string;
  openapiVersion: string | null;
  title: string | null;
  infoVersion: string | null;
  warnings: string[];
  createdAt: Date;
};

export type ContractVersionWithContract = ContractVersionRecord & {
  contract: ContractRecord;
};

export type FindingRecord = {
  id: string;
  analysisRunId: string;
  position: number;
  engineId: string;
  category: FindingCategory;
  changeType: ChangeType;
  risk: RiskLevel;
  path: string | null;
  method: string | null;
  operationId: string | null;
  location: string;
  summary: string;
  explanation: string;
  before: string | null;
  after: string | null;
  createdAt: Date;
};

export type AnalysisRunRecord = {
  id: string;
  projectId: string;
  baselineVersionId: string;
  candidateVersionId: string;
  label: string | null;
  status: AnalysisStatus;
  truncated: boolean;
  totalFindings: number;
  nonBreakingCount: number;
  potentiallyBreakingCount: number;
  unknownCount: number;
  durationMs: number;
  limitations: string[];
  baselineSummary: ContractSummaryRecord;
  candidateSummary: ContractSummaryRecord;
  createdAt: Date;
};

export type AnalysisRunWithVersions = AnalysisRunRecord & {
  baselineVersion: ContractVersionRecord;
  candidateVersion: ContractVersionRecord;
};

export type AnalysisRunDetailRecord = AnalysisRunRecord & {
  baselineVersion: ContractVersionWithContract;
  candidateVersion: ContractVersionWithContract;
  findings: FindingRecord[];
};

export type CreateProjectInput = {
  name: string;
  description?: string;
};

export type UpdateProjectInput = {
  name?: string;
  description?: string;
};

export type CreateContractInput = {
  projectId: string;
  name: string;
};

export type CreateContractVersionInput = {
  contractId: string;
  label?: string;
  format: ContractFormat;
  rawContent: string;
  checksum: string;
  openapiVersion?: string;
  title?: string;
  infoVersion?: string;
  warnings: string[];
};

export type CreateFindingInput = {
  engineId: string;
  category: FindingCategory;
  changeType: ChangeType;
  risk: RiskLevel;
  path?: string;
  method?: string;
  operationId?: string;
  location: string;
  summary: string;
  explanation: string;
  before?: string;
  after?: string;
};

export type CreateAnalysisRunInput = {
  projectId: string;
  baselineVersionId: string;
  candidateVersionId: string;
  label?: string;
  truncated: boolean;
  totalFindings: number;
  nonBreakingCount: number;
  potentiallyBreakingCount: number;
  unknownCount: number;
  durationMs: number;
  limitations: string[];
  baselineSummary: ContractSummaryRecord;
  candidateSummary: ContractSummaryRecord;
  findings: CreateFindingInput[];
};

/**
 * Persistence boundary for the API. Services depend on this interface so they
 * can be tested with an in-memory implementation and later swapped or wrapped
 * (for example for ownership scoping).
 */
export interface Repository {
  ping(): Promise<void>;

  createProject(input: CreateProjectInput): Promise<ProjectRecord>;
  listProjects(): Promise<ProjectRecordWithCount[]>;
  getProject(id: string): Promise<ProjectRecordWithCount | null>;
  updateProject(id: string, input: UpdateProjectInput): Promise<ProjectRecord | null>;

  createContract(input: CreateContractInput): Promise<ContractRecord>;
  listContractsByProject(projectId: string): Promise<ContractRecordWithCount[]>;
  getContract(id: string): Promise<ContractRecordWithCount | null>;

  createContractVersion(input: CreateContractVersionInput): Promise<ContractVersionRecord>;
  getContractVersion(id: string): Promise<ContractVersionWithContract | null>;
  listVersionsByContract(contractId: string): Promise<ContractVersionRecord[]>;

  createAnalysisRun(input: CreateAnalysisRunInput): Promise<AnalysisRunRecord>;
  getAnalysisRun(id: string): Promise<AnalysisRunDetailRecord | null>;
  listAnalysisRunsByProject(projectId: string): Promise<AnalysisRunWithVersions[]>;
}
