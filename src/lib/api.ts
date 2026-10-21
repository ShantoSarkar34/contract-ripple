import type {
  AnalysisRunDetailDto,
  AnalysisRunDto,
  AuthSessionResponse,
  AuthUserDto,
  ContractDetailDto,
  ContractDto,
  ContractVersionDetailDto,
  ContractVersionDto,
  CreateComparisonRequest,
  CreateContractRequest,
  CreateContractVersionRequest,
  CreateGithubSourceRequest,
  CreateProjectRequest,
  GitHubStatusResponse,
  ListAnalysesResponse,
  ListContractsResponse,
  ListProjectsResponse,
  ListSourceSnapshotsResponse,
  ListVersionsResponse,
  LoginRequest,
  ProjectDto,
  ReadyResponse,
  RegisterRequest,
  ReportFormat,
  SourceSnapshotDetailDto,
  SourceSnapshotDto,
  UpdateProjectRequest,
} from "@contract-ripple/shared";

/**
 * Base URL for the Express API, including the `/api/v1` prefix. Configure it
 * with `NEXT_PUBLIC_API_BASE_URL` (see `.env.example`).
 */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1"
).replace(/\/+$/, "");

const ERROR_CODES_WITH_DETAILS = new Set(["validation_error"]);

/**
 * CSRF token returned by the auth endpoints. It is kept in memory only and
 * attached to unsafe requests. The session itself is an HttpOnly cookie that
 * JavaScript never reads.
 */
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Lets the auth provider react to an expired or revoked session. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Error thrown for any non-2xx API response or network failure. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

type ErrorEnvelope = {
  error: { code: string; message: string; details?: unknown };
};

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const error = (value as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as { code?: unknown; message?: unknown };
  return typeof candidate.code === "string" && typeof candidate.message === "string";
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Formats a validation error's field details for display. Only used for
 * `validation_error`, whose details are a bounded array of `{ path, message }`.
 */
export function describeErrorDetails(error: ApiRequestError): string[] {
  if (!ERROR_CODES_WITH_DETAILS.has(error.code) || !Array.isArray(error.details)) {
    return [];
  }
  return error.details.flatMap((detail) => {
    if (typeof detail !== "object" || detail === null) {
      return [];
    }
    const { path, message } = detail as { path?: unknown; message?: unknown };
    if (typeof message !== "string") {
      return [];
    }
    return [typeof path === "string" && path.length > 0 ? `${path}: ${message}` : message];
  });
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  if (!isFormData && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (!SAFE_METHODS.has(method) && csrfToken) {
    headers.set("x-csrf-token", csrfToken);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      ...init,
      headers,
    });
  } catch {
    throw new ApiRequestError(
      0,
      "network_error",
      `Could not reach the API at ${API_BASE_URL}. Confirm the backend is running.`,
    );
  }

  if (response.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
    csrfToken = null;
    unauthorizedHandler?.();
  }

  const text = await response.text();
  const payload = text.length > 0 ? safeJson(text) : undefined;

  if (!response.ok) {
    if (isErrorEnvelope(payload)) {
      throw new ApiRequestError(
        response.status,
        payload.error.code,
        payload.error.message,
        payload.error.details,
      );
    }
    throw new ApiRequestError(
      response.status,
      "unknown_error",
      `Request failed with status ${response.status}.`,
    );
  }

  return payload as T;
}

async function requestBlob(path: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  } catch {
    throw new ApiRequestError(
      0,
      "network_error",
      `Could not reach the API at ${API_BASE_URL}. Confirm the backend is running.`,
    );
  }

  if (response.status === 401) {
    csrfToken = null;
    unauthorizedHandler?.();
  }

  if (!response.ok) {
    const text = await response.text();
    const payload = text.length > 0 ? safeJson(text) : undefined;
    if (isErrorEnvelope(payload)) {
      throw new ApiRequestError(
        response.status,
        payload.error.code,
        payload.error.message,
        payload.error.details,
      );
    }
    throw new ApiRequestError(
      response.status,
      "unknown_error",
      `Request failed with status ${response.status}.`,
    );
  }

  return response.blob();
}

function id(value: string): string {
  return encodeURIComponent(value);
}

export const api = {
  getSession(): Promise<AuthSessionResponse> {
    return request<AuthSessionResponse>("/auth/me");
  },

  register(input: RegisterRequest): Promise<AuthSessionResponse> {
    return request<AuthSessionResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  login(input: LoginRequest): Promise<AuthSessionResponse> {
    return request<AuthSessionResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  logout(): Promise<void> {
    return request<void>("/auth/logout", { method: "POST" });
  },

  getReady(): Promise<ReadyResponse> {
    return request<ReadyResponse>("/ready");
  },

  listProjects(): Promise<ListProjectsResponse> {
    return request<ListProjectsResponse>("/projects");
  },

  createProject(input: CreateProjectRequest): Promise<ProjectDto> {
    return request<ProjectDto>("/projects", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getProject(projectId: string): Promise<ProjectDto> {
    return request<ProjectDto>(`/projects/${id(projectId)}`);
  },

  updateProject(projectId: string, input: UpdateProjectRequest): Promise<ProjectDto> {
    return request<ProjectDto>(`/projects/${id(projectId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  listContracts(projectId: string): Promise<ListContractsResponse> {
    return request<ListContractsResponse>(`/projects/${id(projectId)}/contracts`);
  },

  createContract(projectId: string, input: CreateContractRequest): Promise<ContractDto> {
    return request<ContractDto>(`/projects/${id(projectId)}/contracts`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getContract(contractId: string): Promise<ContractDetailDto> {
    return request<ContractDetailDto>(`/contracts/${id(contractId)}`);
  },

  listVersions(contractId: string): Promise<ListVersionsResponse> {
    return request<ListVersionsResponse>(`/contracts/${id(contractId)}/versions`);
  },

  createContractVersion(
    contractId: string,
    input: CreateContractVersionRequest,
  ): Promise<ContractVersionDto> {
    return request<ContractVersionDto>(`/contracts/${id(contractId)}/versions`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getVersion(versionId: string): Promise<ContractVersionDetailDto> {
    return request<ContractVersionDetailDto>(`/versions/${id(versionId)}`);
  },

  listComparisons(
    projectId: string,
    options: { limit?: number; cursor?: string } = {},
  ): Promise<ListAnalysesResponse> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) {
      params.set("limit", String(options.limit));
    }
    if (options.cursor) {
      params.set("cursor", options.cursor);
    }
    const query = params.toString();
    return request<ListAnalysesResponse>(
      `/projects/${id(projectId)}/comparisons${query ? `?${query}` : ""}`,
    );
  },

  createComparison(
    projectId: string,
    input: CreateComparisonRequest,
  ): Promise<AnalysisRunDetailDto> {
    return request<AnalysisRunDetailDto>(`/projects/${id(projectId)}/comparisons`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  getComparison(comparisonId: string): Promise<AnalysisRunDetailDto> {
    return request<AnalysisRunDetailDto>(`/comparisons/${id(comparisonId)}`);
  },

  getComparisonReportFile(
    comparisonId: string,
    format: ReportFormat,
  ): Promise<Blob> {
    return requestBlob(
      `/comparisons/${id(comparisonId)}/report?format=${encodeURIComponent(format)}`,
    );
  },

  getGitHubStatus(): Promise<GitHubStatusResponse> {
    return request<GitHubStatusResponse>("/github/status");
  },

  listSourceSnapshots(projectId: string): Promise<ListSourceSnapshotsResponse> {
    return request<ListSourceSnapshotsResponse>(`/projects/${id(projectId)}/source`);
  },

  getSourceSnapshot(snapshotId: string): Promise<SourceSnapshotDetailDto> {
    return request<SourceSnapshotDetailDto>(`/source/${id(snapshotId)}`);
  },

  analyzeZipSource(
    projectId: string,
    archive: File | Blob,
    options: { analysisRunId?: string } = {},
  ): Promise<SourceSnapshotDetailDto> {
    const form = new FormData();
    const filename = typeof File !== "undefined" && archive instanceof File ? archive.name : "source.zip";
    form.append("archive", archive, filename);
    if (options.analysisRunId) {
      form.append("analysisRunId", options.analysisRunId);
    }
    return request<SourceSnapshotDetailDto>(`/projects/${id(projectId)}/source/zip`, {
      method: "POST",
      body: form,
    });
  },

  analyzeGithubSource(
    projectId: string,
    input: CreateGithubSourceRequest,
  ): Promise<SourceSnapshotDetailDto> {
    return request<SourceSnapshotDetailDto>(`/projects/${id(projectId)}/source/github`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

export type {
  AnalysisRunDetailDto,
  AnalysisRunDto,
  AuthSessionResponse,
  AuthUserDto,
  ContractDto,
  ContractVersionDto,
  ProjectDto,
  SourceSnapshotDetailDto,
  SourceSnapshotDto,
};
