/** Types for the ContractRipple source-analysis package. */

export const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const SOURCE_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type SourceConfidence = (typeof SOURCE_CONFIDENCE_LEVELS)[number];

export const SUPPORTED_SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
] as const;

export const SOURCE_ANALYSIS_LIMITS = {
  /** Maximum number of source files considered in one analysis. */
  maxFiles: 2_000,
  /** Maximum size of a single source file. */
  maxFileBytes: 1024 * 1024,
  /** Maximum total size of all considered source files. */
  maxTotalBytes: 25 * 1024 * 1024,
  /** Maximum number of matched references returned. */
  maxMatches: 1_000,
  /** Maximum characters of source included as evidence per match. */
  maxSnippetChars: 280,
  /** Wall-clock budget for one analysis run. */
  maxDurationMs: 20_000,
} as const;

export type SourceAnalysisErrorCode =
  | "too_many_files"
  | "source_too_large"
  | "analysis_timeout";

export class SourceAnalysisError extends Error {
  constructor(
    readonly code: SourceAnalysisErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SourceAnalysisError";
  }
}

/** One source file, already decoded as UTF-8 text. */
export type SourceFileInput = {
  path: string;
  content: string;
};

/** A changed OpenAPI operation that source calls should be matched against. */
export type ChangedOperation = {
  /** Lower-case HTTP method. */
  method: HttpMethod;
  /** OpenAPI path template, for example `/pets/{petId}`. */
  path: string;
  operationId?: string | null;
};

/** A statically detectable API call that matches a changed operation. */
export type SourceMatch = {
  filePath: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column number. */
  column: number;
  /** Trimmed source line (bounded). */
  snippet: string;
  /** Callee text, for example `fetch` or `axios.post`. */
  call: string;
  /** HTTP method inferred from the call. */
  method: HttpMethod;
  /** Normalized request path inferred from the call. */
  path: string;
  matchedMethod: HttpMethod;
  matchedPath: string;
  operationId: string | null;
  confidence: SourceConfidence;
  /** Human-readable evidence for the match. */
  evidence: string;
};

export type SourceAnalysisResult = {
  filesScanned: number;
  filesSkipped: number;
  totalBytes: number;
  matches: SourceMatch[];
  limitations: string[];
};

export type SourceAnalysisOptions = {
  maxFiles?: number;
  maxFileBytes?: number;
  maxTotalBytes?: number;
  maxMatches?: number;
  maxDurationMs?: number;
};
