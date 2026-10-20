import {
  HTTP_METHODS,
  SourceAnalysisError,
  analyzeSource,
  type ChangedOperation,
  type HttpMethod,
  type SourceFileInput,
} from "@contract-ripple/source-analysis";
import type {
  GitHubSourceFields,
  GitHubStatusResponse,
  ListSourceSnapshotsResponse,
  SourceSnapshotDetailDto,
  ZipSourceFields,
} from "@contract-ripple/shared";
import type { AnalysisRunDetailRecord, Repository } from "../db/types.js";
import { HttpError, badRequest, notFound } from "../middleware/http-error.js";
import {
  fetchGitHubSource,
  GitHubError,
  type GitHubFetch,
  type GitHubSourceResult,
} from "./github.js";
import { toSourceSnapshotDetailDto, toSourceSnapshotDto } from "./serialization.js";
import { MAX_ARCHIVE_BYTES, ZipError, extractSourceFromZip } from "./zip.js";

export type SourceServiceOptions = {
  githubToken: string;
  githubApiBaseUrl?: string;
  githubFetch?: GitHubFetch;
};

type SourceInput = {
  projectId: string;
  analysisRunId?: string;
  sourceType: "zip" | "github";
  repository?: string;
  ref?: string;
  files: SourceFileInput[];
  skipped: Array<{ path: string; reason: string }>;
  limitations: string[];
};

function isHttpMethod(value: string): value is HttpMethod {
  return (HTTP_METHODS as readonly string[]).includes(value);
}

function changedOperationsFromRun(run: AnalysisRunDetailRecord): ChangedOperation[] {
  const operations = new Map<string, ChangedOperation>();
  for (const finding of run.findings) {
    if (!finding.path || !finding.method) {
      continue;
    }
    const method = finding.method.toLowerCase();
    if (!isHttpMethod(method)) {
      continue;
    }
    const key = `${method} ${finding.path}`;
    if (!operations.has(key)) {
      operations.set(key, {
        method,
        path: finding.path,
        operationId: finding.operationId,
      });
    }
  }
  return [...operations.values()];
}

async function resolveAnalysisRun(
  repository: Repository,
  projectId: string,
  analysisRunId: string | undefined,
): Promise<AnalysisRunDetailRecord> {
  if (analysisRunId) {
    const run = await repository.getAnalysisRun(analysisRunId);
    if (!run) {
      throw notFound("comparison_not_found", "Comparison not found.");
    }
    if (run.projectId !== projectId) {
      throw badRequest(
        "comparison_project_mismatch",
        "The comparison does not belong to this project.",
      );
    }
    return run;
  }

  const runs = await repository.listAnalysisRunsByProject(projectId);
  const latest = runs[0];
  if (!latest) {
    throw badRequest(
      "no_comparison",
      "Run a contract comparison before analyzing source code.",
    );
  }

  const detail = await repository.getAnalysisRun(latest.id);
  if (!detail) {
    throw notFound("comparison_not_found", "Comparison not found.");
  }
  return detail;
}

function mapZipError(error: ZipError): HttpError {
  switch (error.code) {
    case "invalid_zip":
    case "unsafe_path":
      return badRequest(error.code, error.message);
    case "too_many_entries":
    case "too_many_files":
    case "archive_too_large":
      return new HttpError(413, error.code, error.message);
  }
}

function mapSourceAnalysisError(error: SourceAnalysisError): HttpError {
  if (error.code === "analysis_timeout") {
    return new HttpError(408, error.code, error.message);
  }
  return new HttpError(413, error.code, error.message);
}

function mapGitHubError(error: GitHubError): HttpError {
  switch (error.code) {
    case "github_not_configured":
      return new HttpError(503, error.code, error.message);
    case "github_invalid_repository":
      return badRequest(error.code, error.message);
    case "github_unauthorized":
      return new HttpError(503, error.code, error.message);
    case "github_forbidden":
      return new HttpError(403, error.code, error.message);
    case "github_not_found":
      return new HttpError(404, error.code, error.message);
    case "github_rate_limited":
      return new HttpError(429, error.code, error.message);
    case "github_timeout":
      return new HttpError(504, error.code, error.message);
    case "github_unavailable":
      return new HttpError(502, error.code, error.message);
  }
}

function dedupeLimitations(values: readonly string[]): string[] {
  return [...new Set(values)];
}

async function persistSourceAnalysis(
  repository: Repository,
  input: SourceInput,
): Promise<SourceSnapshotDetailDto> {
  const run = await resolveAnalysisRun(repository, input.projectId, input.analysisRunId);
  const operations = changedOperationsFromRun(run);

  let analysis;
  try {
    analysis = analyzeSource(input.files, operations);
  } catch (error) {
    if (error instanceof SourceAnalysisError) {
      throw mapSourceAnalysisError(error);
    }
    throw error;
  }

  const snapshot = await repository.createSourceSnapshot({
    projectId: input.projectId,
    analysisRunId: run.id,
    sourceType: input.sourceType,
    repository: input.repository,
    ref: input.ref,
    fileCount: analysis.filesScanned,
    skippedCount: analysis.filesSkipped + input.skipped.length,
    totalBytes: analysis.totalBytes,
    limitations: dedupeLimitations([...input.limitations, ...analysis.limitations]),
    files: [
      ...input.files.map((file) => ({
        path: file.path,
        bytes: Buffer.byteLength(file.content, "utf8"),
        skipped: false,
      })),
      ...input.skipped.map((file) => ({
        path: file.path,
        bytes: 0,
        skipped: true,
        reason: file.reason,
      })),
    ],
    impacts: analysis.matches.map((match) => ({
      filePath: match.filePath,
      line: match.line,
      column: match.column,
      snippet: match.snippet,
      call: match.call,
      method: match.method,
      path: match.path,
      matchedMethod: match.matchedMethod,
      matchedPath: match.matchedPath,
      operationId: match.operationId ?? undefined,
      confidence: match.confidence,
      evidence: match.evidence,
    })),
  });

  const detail = await repository.getSourceSnapshot(snapshot.id);
  if (!detail) {
    throw new Error("Source snapshot could not be read back after creation.");
  }
  return toSourceSnapshotDetailDto(detail);
}

export async function analyzeZipSource(
  repository: Repository,
  projectId: string,
  archive: Uint8Array,
  fields: ZipSourceFields,
): Promise<SourceSnapshotDetailDto> {
  const project = await repository.getProject(projectId);
  if (!project) {
    throw notFound("project_not_found", "Project not found.");
  }

  if (archive.byteLength === 0) {
    throw badRequest("empty_archive", "The uploaded ZIP archive is empty.");
  }
  if (archive.byteLength > MAX_ARCHIVE_BYTES) {
    throw new HttpError(
      413,
      "archive_too_large",
      `ZIP uploads are limited to ${MAX_ARCHIVE_BYTES} bytes.`,
    );
  }

  let extraction;
  try {
    extraction = extractSourceFromZip(archive);
  } catch (error) {
    if (error instanceof ZipError) {
      throw mapZipError(error);
    }
    throw error;
  }

  if (extraction.files.length === 0) {
    throw badRequest(
      "no_supported_source",
      "The archive did not contain any supported TypeScript or JavaScript files.",
    );
  }

  return persistSourceAnalysis(repository, {
    projectId,
    analysisRunId: fields.analysisRunId,
    sourceType: "zip",
    files: extraction.files,
    skipped: extraction.skipped,
    limitations: [],
  });
}

export async function analyzeGitHubSource(
  repository: Repository,
  projectId: string,
  input: GitHubSourceFields,
  options: SourceServiceOptions,
): Promise<SourceSnapshotDetailDto> {
  if (options.githubToken.trim().length === 0) {
    throw new HttpError(
      503,
      "github_not_configured",
      "GitHub integration is not configured. Set GITHUB_TOKEN on the API server.",
    );
  }

  const project = await repository.getProject(projectId);
  if (!project) {
    throw notFound("project_not_found", "Project not found.");
  }

  let source: GitHubSourceResult;
  try {
    source = await fetchGitHubSource({
      repository: input.repository,
      ref: input.ref,
      token: options.githubToken,
      apiBaseUrl: options.githubApiBaseUrl,
      fetchImpl: options.githubFetch,
    });
  } catch (error) {
    if (error instanceof GitHubError) {
      throw mapGitHubError(error);
    }
    throw error;
  }

  if (source.files.length === 0) {
    throw badRequest(
      "no_supported_source",
      "The repository did not contain any supported TypeScript or JavaScript files.",
    );
  }

  return persistSourceAnalysis(repository, {
    projectId,
    analysisRunId: input.analysisRunId,
    sourceType: "github",
    repository: source.repository,
    ref: source.ref,
    files: source.files,
    skipped: source.skipped,
    limitations: source.limitations,
  });
}

export async function listSourceSnapshots(
  repository: Repository,
  projectId: string,
): Promise<ListSourceSnapshotsResponse> {
  const project = await repository.getProject(projectId);
  if (!project) {
    throw notFound("project_not_found", "Project not found.");
  }

  const snapshots = await repository.listSourceSnapshotsByProject(projectId);
  return { snapshots: snapshots.map(toSourceSnapshotDto) };
}

export async function getSourceSnapshot(
  repository: Repository,
  snapshotId: string,
): Promise<SourceSnapshotDetailDto> {
  const snapshot = await repository.getSourceSnapshot(snapshotId);
  if (!snapshot) {
    throw notFound("source_snapshot_not_found", "Source analysis snapshot not found.");
  }
  return toSourceSnapshotDetailDto(snapshot);
}

export function getGitHubStatus(options: SourceServiceOptions): GitHubStatusResponse {
  return { configured: options.githubToken.trim().length > 0 };
}
