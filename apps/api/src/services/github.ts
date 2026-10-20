import {
  SOURCE_ANALYSIS_LIMITS,
  hasIgnoredDirectory,
  isSupportedSourcePath,
  type SourceFileInput,
} from "@contract-ripple/source-analysis";

export type GitHubErrorCode =
  | "github_not_configured"
  | "github_invalid_repository"
  | "github_unauthorized"
  | "github_forbidden"
  | "github_not_found"
  | "github_rate_limited"
  | "github_timeout"
  | "github_unavailable";

export class GitHubError extends Error {
  constructor(
    readonly code: GitHubErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export type GitHubFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type GitHubSkippedFile = {
  path: string;
  reason: "ignored_directory" | "file_too_large" | "non_utf8_text" | "fetch_failed";
};

export type GitHubSourceResult = {
  repository: string;
  ref: string;
  files: SourceFileInput[];
  skipped: GitHubSkippedFile[];
  totalBytes: number;
  limitations: string[];
};

export type FetchGitHubSourceInput = {
  repository: string;
  ref?: string;
  /** Server-side GitHub token. Never returned to clients or logged. */
  token: string;
  apiBaseUrl?: string;
  fetchImpl?: GitHubFetch;
};

type GitHubRepoResponse = {
  default_branch?: unknown;
  full_name?: unknown;
};

type GitHubCommitResponse = {
  sha?: unknown;
};

type GitHubTreeResponse = {
  tree?: unknown;
  truncated?: unknown;
};

type GitHubTreeEntry = {
  path: string;
  type: string;
  size: number;
  sha: string;
};

type GitHubBlobResponse = {
  content?: unknown;
  encoding?: unknown;
};

const DEFAULT_API_BASE_URL = "https://api.github.com";
const REQUEST_TIMEOUT_MS = 15_000;
const ANALYSIS_TIMEOUT_MS = 60_000;
const BLOB_CONCURRENCY = 6;
const MAX_REPORTED_SKIPPED_FILES = 5_000;
const decoder = new TextDecoder("utf-8", { fatal: true });

function normalizeApiBaseUrl(value: string | undefined): string {
  return (value ?? DEFAULT_API_BASE_URL).replace(/\/+$/, "");
}

/**
 * Accepts `owner/repository`, `https://github.com/owner/repository`, and
 * `.git`-suffixed forms. GitHub Enterprise hosts are intentionally unsupported.
 */
export function parseGitHubRepository(value: string): { owner: string; repo: string } | null {
  let raw = value.trim();
  raw = raw.replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "");
  raw = raw.replace(/^\/+|\/+$/g, "");

  const parts = raw.split("/");
  if (parts.length !== 2) {
    return null;
  }
  const [owner, repo] = parts;
  if (!owner || !repo || owner === "." || owner === ".." || repo === "." || repo === "..") {
    return null;
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo)) {
    return null;
  }
  return { owner, repo };
}

function repositoryPath(owner: string, repo: string): string {
  return `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

async function requestJson<T>(
  url: string,
  token: string,
  fetchImpl: GitHubFetch,
): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "user-agent": "contract-ripple",
        "x-github-api-version": "2022-11-28",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof GitHubError) {
      throw error;
    }
    throw new GitHubError("github_unavailable", "GitHub could not be reached.");
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new GitHubError(
        "github_unauthorized",
        "GitHub rejected the configured token.",
        response.status,
      );
    }
    if (response.status === 403 || response.status === 429) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      if (response.status === 429 || remaining === "0") {
        const reset = response.headers.get("x-ratelimit-reset");
        const when =
          reset && /^\d+$/.test(reset)
            ? new Date(Number(reset) * 1000).toISOString()
            : null;
        throw new GitHubError(
          "github_rate_limited",
          when
            ? `GitHub rate limit exceeded; try again after ${when}.`
            : "GitHub rate limit exceeded. Try again later.",
          response.status,
        );
      }
      throw new GitHubError(
        "github_forbidden",
        "GitHub refused access to this repository.",
        response.status,
      );
    }
    if (response.status === 404) {
      throw new GitHubError(
        "github_not_found",
        "GitHub repository or ref was not found, or the token cannot access it.",
        response.status,
      );
    }
    throw new GitHubError(
      "github_unavailable",
      `GitHub request failed with status ${response.status}.`,
      response.status,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new GitHubError("github_unavailable", "GitHub returned an unreadable response.");
  }
}

function readTreeEntries(value: unknown): GitHubTreeEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries: GitHubTreeEntry[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const entry = item as { path?: unknown; type?: unknown; size?: unknown; sha?: unknown };
    if (
      typeof entry.path === "string" &&
      typeof entry.type === "string" &&
      typeof entry.sha === "string" &&
      entry.path.length > 0 &&
      entry.sha.length > 0
    ) {
      entries.push({
        path: entry.path,
        type: entry.type,
        sha: entry.sha,
        size: typeof entry.size === "number" && Number.isFinite(entry.size) ? entry.size : 0,
      });
    }
  }
  return entries;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) {
        return;
      }
      const item = items[index];
      if (item === undefined) {
        return;
      }
      results[index] = await worker(item);
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * Fetches supported TypeScript/JavaScript files from a GitHub repository using
 * the official REST API. The repository is never cloned and no code is run.
 *
 * Requires a server-side token (GitHub App installation token or a fine-grained
 * PAT with `contents:read`). Without a token a `github_not_configured` error is
 * returned instead of a fake result.
 */
export async function fetchGitHubSource(
  input: FetchGitHubSourceInput,
): Promise<GitHubSourceResult> {
  const token = input.token.trim();
  if (token.length === 0) {
    throw new GitHubError(
      "github_not_configured",
      "GitHub integration is not configured. Set GITHUB_TOKEN on the API server.",
    );
  }

  const parsed = parseGitHubRepository(input.repository);
  if (!parsed) {
    throw new GitHubError(
      "github_invalid_repository",
      "Enter a GitHub repository as owner/name or a github.com URL.",
    );
  }

  const apiBase = normalizeApiBaseUrl(input.apiBaseUrl);
  const rawFetch = input.fetchImpl ?? fetch;
  const deadline = Date.now() + ANALYSIS_TIMEOUT_MS;
  const fetchImpl: GitHubFetch = async (url, init) => {
    if (Date.now() > deadline) {
      throw new GitHubError(
        "github_timeout",
        `GitHub source analysis exceeded the ${ANALYSIS_TIMEOUT_MS / 1000} second time limit.`,
      );
    }
    return rawFetch(url, init);
  };
  const path = repositoryPath(parsed.owner, parsed.repo);

  const repo = await requestJson<GitHubRepoResponse>(
    `${apiBase}/repos/${path}`,
    token,
    fetchImpl,
  );
  const ref =
    (typeof input.ref === "string" && input.ref.trim().length > 0)
      ? input.ref.trim()
      : typeof repo.default_branch === "string"
        ? repo.default_branch
        : "";
  if (ref.length === 0) {
    throw new GitHubError("github_unavailable", "GitHub did not report a default branch.");
  }

  const commit = await requestJson<GitHubCommitResponse>(
    `${apiBase}/repos/${path}/commits/${encodeURIComponent(ref)}`,
    token,
    fetchImpl,
  );
  if (typeof commit.sha !== "string" || commit.sha.length === 0) {
    throw new GitHubError("github_unavailable", "GitHub did not return a commit for this ref.");
  }

  const tree = await requestJson<GitHubTreeResponse>(
    `${apiBase}/repos/${path}/git/trees/${encodeURIComponent(commit.sha)}?recursive=1`,
    token,
    fetchImpl,
  );

  const limitations: string[] = [];
  if (tree.truncated === true) {
    limitations.push(
      "GitHub truncated the repository tree, so very large repositories may be partially analyzed.",
    );
  }

  const candidates: Array<{ path: string; sha: string }> = [];
  const skipped: GitHubSkippedFile[] = [];
  let skippedOverflow = 0;
  const reportSkipped = (path: string, reason: GitHubSkippedFile["reason"]): void => {
    if (skipped.length < MAX_REPORTED_SKIPPED_FILES) {
      skipped.push({ path, reason });
    } else {
      skippedOverflow += 1;
    }
  };
  let plannedBytes = 0;
  let limitReached = false;

  for (const entry of readTreeEntries(tree.tree)) {
    if (entry.type !== "blob") {
      continue;
    }
    if (hasIgnoredDirectory(entry.path)) {
      reportSkipped(entry.path, "ignored_directory");
      continue;
    }
    if (!isSupportedSourcePath(entry.path)) {
      continue;
    }
    if (entry.size > SOURCE_ANALYSIS_LIMITS.maxFileBytes) {
      reportSkipped(entry.path, "file_too_large");
      continue;
    }
    if (
      candidates.length >= SOURCE_ANALYSIS_LIMITS.maxFiles ||
      plannedBytes + entry.size > SOURCE_ANALYSIS_LIMITS.maxTotalBytes
    ) {
      limitReached = true;
      break;
    }
    plannedBytes += entry.size;
    candidates.push({ path: entry.path, sha: entry.sha });
  }

  if (limitReached) {
    limitations.push(
      `Source analysis stopped at the configured file or byte limit; ${candidates.length} file(s) were considered.`,
    );
  }

  const files: SourceFileInput[] = [];
  let fetchFailures = 0;

  const results = await mapWithConcurrency(candidates, BLOB_CONCURRENCY, async (candidate) => {
    try {
      const blob = await requestJson<GitHubBlobResponse>(
        `${apiBase}/repos/${path}/git/blobs/${encodeURIComponent(candidate.sha)}`,
        token,
        fetchImpl,
      );
      if (blob.encoding !== "base64" || typeof blob.content !== "string") {
        return { candidate, content: null, reason: "non_utf8_text" as const };
      }
      const buffer = Buffer.from(blob.content, "base64");
      if (buffer.byteLength > SOURCE_ANALYSIS_LIMITS.maxFileBytes) {
        return { candidate, content: null, reason: "file_too_large" as const };
      }
      try {
        return {
          candidate,
          content: decoder.decode(buffer),
          reason: null,
        };
      } catch {
        return { candidate, content: null, reason: "non_utf8_text" as const };
      }
    } catch (error) {
      if (
        error instanceof GitHubError &&
        (error.code === "github_unauthorized" ||
          error.code === "github_forbidden" ||
          error.code === "github_rate_limited" ||
          error.code === "github_timeout")
      ) {
        throw error;
      }
      return { candidate, content: null, reason: "fetch_failed" as const };
    }
  });

  for (const result of results) {
    if (result.content === null) {
      reportSkipped(result.candidate.path, result.reason ?? "fetch_failed");
      if (result.reason === "fetch_failed") {
        fetchFailures += 1;
      }
    } else {
      files.push({ path: result.candidate.path, content: result.content });
    }
  }

  if (fetchFailures > 0) {
    limitations.push(
      `${fetchFailures} file(s) could not be fetched from GitHub and were skipped.`,
    );
  }
  if (skippedOverflow > 0) {
    limitations.push(
      `${skippedOverflow} additional skipped file(s) were not listed because the report limit was reached.`,
    );
  }

  const totalBytes = files.reduce(
    (sum, file) => sum + Buffer.byteLength(file.content, "utf8"),
    0,
  );

  return {
    repository: `${parsed.owner}/${parsed.repo}`,
    ref,
    files,
    skipped,
    totalBytes,
    limitations,
  };
}
