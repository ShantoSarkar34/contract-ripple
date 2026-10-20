/**
 * Shared API schemas and DTO types for ContractRipple.
 *
 * Request schemas are validated on the server and can be reused by the client
 * for early feedback. Response types describe the JSON payloads the API
 * returns. Keep this module free of database, HTTP, and analysis-engine code.
 */

import { z } from "zod";

export const CONTRACT_FORMATS = ["json", "yaml"] as const;
export type ContractFormat = (typeof CONTRACT_FORMATS)[number];

export const RISK_LEVELS = ["non_breaking", "potentially_breaking", "unknown"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const CHANGE_TYPES = ["added", "removed", "modified"] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export const FINDING_CATEGORIES = [
  "operation",
  "operation_id",
  "parameter",
  "request_body",
  "response",
  "required_property",
  "schema_property",
  "reference",
  "combinator",
] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export const ANALYSIS_STATUSES = ["completed", "failed"] as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number];

export const SOURCE_TYPES = ["zip", "github"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_CONFIDENCES = ["high", "medium", "low"] as const;
export type SourceConfidence = (typeof SOURCE_CONFIDENCES)[number];

export const REPORT_FORMATS = ["json", "markdown"] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

/** Engine input limits, mirrored from the engine defaults. */
export const MAX_CONTRACT_BYTES = 5 * 1024 * 1024;

/** Maximum ZIP upload accepted for source analysis. */
export const MAX_SOURCE_ARCHIVE_BYTES = 10 * 1024 * 1024;

/** Saved comparison history is paginated; these bounds apply to the API and UI. */
export const DEFAULT_HISTORY_PAGE_SIZE = 20;
export const MAX_HISTORY_PAGE_SIZE = 50;

/* -------------------------------------------------------------------------- */
/* Request schemas                                                            */
/* -------------------------------------------------------------------------- */

export const createProjectRequestSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
});
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

export const updateProjectRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
  })
  .refine((value) => value.name !== undefined || value.description !== undefined, {
    message: "Provide at least one of name or description.",
  });
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;

export const createContractRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
});
export type CreateContractRequest = z.infer<typeof createContractRequestSchema>;

export const createContractVersionRequestSchema = z.object({
  content: z
    .string()
    .min(1, "Contract content must not be empty.")
    .refine(
      (value) => utf8ByteLength(value) <= MAX_CONTRACT_BYTES,
      `Contract content must not exceed ${MAX_CONTRACT_BYTES} bytes.`,
    ),
  format: z.enum(CONTRACT_FORMATS).optional(),
  label: z.string().trim().max(120).optional(),
});
export type CreateContractVersionRequest = z.infer<typeof createContractVersionRequestSchema>;

export const createComparisonRequestSchema = z.object({
  baselineVersionId: z.string().trim().min(1),
  candidateVersionId: z.string().trim().min(1),
  label: z.string().trim().max(200).optional(),
});
export type CreateComparisonRequest = z.infer<typeof createComparisonRequestSchema>;

export const listComparisonsQuerySchema = z.object({
  cursor: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_HISTORY_PAGE_SIZE)
    .default(DEFAULT_HISTORY_PAGE_SIZE),
});
export type ListComparisonsQuery = z.infer<typeof listComparisonsQuerySchema>;

export const reportQuerySchema = z.object({
  format: z.enum(REPORT_FORMATS).default("json"),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const githubSourceFieldsSchema = z.object({
  repository: z.string().trim().min(1).max(300),
  ref: z.string().trim().max(200).optional(),
  analysisRunId: z.string().trim().min(1).optional(),
});
export type GitHubSourceFields = z.infer<typeof githubSourceFieldsSchema>;

export const createGithubSourceRequestSchema = githubSourceFieldsSchema;
export type CreateGithubSourceRequest = GitHubSourceFields;

/** Text fields accepted alongside a multipart ZIP upload. */
export const zipSourceFieldsSchema = z.object({
  analysisRunId: z.string().trim().min(1).optional(),
});
export type ZipSourceFields = z.infer<typeof zipSourceFieldsSchema>;

/* -------------------------------------------------------------------------- */
/* Response DTOs                                                              */
/* -------------------------------------------------------------------------- */

export type ProjectDto = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  contractCount: number;
};

export type ContractDto = {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  versionCount: number;
};

export type ContractVersionDto = {
  id: string;
  contractId: string;
  label: string | null;
  format: ContractFormat;
  openapiVersion: string | null;
  title: string | null;
  infoVersion: string | null;
  checksum: string;
  contentBytes: number;
  warnings: string[];
  createdAt: string;
};

export type ContractVersionDetailDto = ContractVersionDto & {
  content: string;
};

export type ContractDetailDto = ContractDto & {
  versions: ContractVersionDto[];
};

export type FindingDto = {
  id: string;
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
};

/**
 * A review prompt derived from findings for one changed operation. It is not
 * generated test code and does not claim that the operation is broken.
 */
export type RegressionSuggestionDto = {
  id: string;
  method: string;
  path: string;
  operationId: string | null;
  risk: RiskLevel;
  title: string;
  rationale: string;
  findingIds: string[];
  evidence: string[];
  suggestedChecks: string[];
};

export type AnalysisRunDto = {
  id: string;
  projectId: string;
  label: string | null;
  status: AnalysisStatus;
  truncated: boolean;
  totalFindings: number;
  nonBreakingCount: number;
  potentiallyBreakingCount: number;
  unknownCount: number;
  durationMs: number;
  createdAt: string;
  baselineVersionId: string;
  candidateVersionId: string;
  baselineVersionLabel: string | null;
  candidateVersionLabel: string | null;
};

export type AnalysisRunDetailDto = AnalysisRunDto & {
  baseline: ContractSummaryDto;
  candidate: ContractSummaryDto;
  limitations: string[];
  findings: FindingDto[];
  regressionSuggestions: RegressionSuggestionDto[];
};

export type ContractSummaryDto = {
  openapi: string;
  title: string | null;
  version: string | null;
  warnings: string[];
  contractId: string;
  contractName: string;
  versionId: string;
  versionLabel: string | null;
};

export type ReadyResponse = {
  status: "ok" | "degraded";
  database: "up" | "down";
  timestamp: string;
};

export type ListProjectsResponse = { projects: ProjectDto[] };
export type ListContractsResponse = { contracts: ContractDto[] };
export type ListVersionsResponse = { versions: ContractVersionDto[] };
export type ListAnalysesResponse = {
  analyses: AnalysisRunDto[];
  nextCursor: string | null;
  totalCount: number;
};

export type SourceImpactDto = {
  id: string;
  filePath: string;
  line: number;
  column: number;
  snippet: string;
  call: string;
  method: string;
  path: string;
  matchedMethod: string;
  matchedPath: string;
  operationId: string | null;
  confidence: SourceConfidence;
  evidence: string;
};

export type SourceFileDto = {
  path: string;
  bytes: number;
  skipped: boolean;
  reason: string | null;
};

export type SourceSnapshotDto = {
  id: string;
  projectId: string;
  analysisRunId: string | null;
  sourceType: SourceType;
  repository: string | null;
  ref: string | null;
  fileCount: number;
  skippedCount: number;
  totalBytes: number;
  impactCount: number;
  limitations: string[];
  createdAt: string;
};

export type SourceSnapshotDetailDto = SourceSnapshotDto & {
  files: SourceFileDto[];
  impacts: SourceImpactDto[];
};

export type ListSourceSnapshotsResponse = { snapshots: SourceSnapshotDto[] };

export type ReportSourceSnapshotDto = SourceSnapshotDto & {
  impacts: SourceImpactDto[];
};

export type AnalysisReportSourceDto = {
  availableSnapshotCount: number;
  includedSnapshotId: string | null;
  snapshot: ReportSourceSnapshotDto | null;
};

/**
 * Downloadable report model. `comparison` holds the persisted summary counts;
 * `findings` and `regressionSuggestions` are the complete persisted analysis.
 */
export type AnalysisReportDto = {
  schemaVersion: "contract-ripple.report.v1";
  generatedAt: string;
  project: { id: string; name: string };
  comparison: AnalysisRunDto;
  baseline: ContractSummaryDto;
  candidate: ContractSummaryDto;
  findings: FindingDto[];
  regressionSuggestions: RegressionSuggestionDto[];
  sourceAnalysis: AnalysisReportSourceDto;
  limitations: string[];
  notes: string[];
};

export type GitHubStatusResponse = {
  configured: boolean;
};

/** UTF-8 byte length without depending on Node or DOM globals. */
export function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) {
      bytes += 1;
    } else if (codePoint <= 0x7ff) {
      bytes += 2;
    } else if (codePoint <= 0xffff) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}
