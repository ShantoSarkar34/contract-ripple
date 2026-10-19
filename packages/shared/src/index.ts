/**
 * Shared, framework-agnostic types used by the web app and the API.
 *
 * Keep this package free of database access, HTTP handlers, and analysis logic.
 * Analysis-specific schemas will be added alongside the OpenAPI engine in Phase 2.
 */

export type HealthResponse = {
  status: "ok";
  service: string;
  timestamp: string;
  uptimeSeconds: number;
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/**
 * Runtime guard for API error envelopes. Useful for client-side error handling
 * without trusting arbitrary response shapes.
 */
export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { error?: unknown };
  if (typeof candidate.error !== "object" || candidate.error === null) {
    return false;
  }

  const error = candidate.error as { code?: unknown; message?: unknown };
  return typeof error.code === "string" && typeof error.message === "string";
}
