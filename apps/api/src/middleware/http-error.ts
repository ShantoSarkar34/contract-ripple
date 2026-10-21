/**
 * Error type carrying an HTTP status and a stable error code. Route handlers
 * throw these; the central error handler turns them into the API error
 * envelope. Messages are safe to return (no stack traces or raw payloads).
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function badRequest(code: string, message: string, details?: unknown): HttpError {
  return new HttpError(400, code, message, details);
}

export function notFound(code: string, message: string): HttpError {
  return new HttpError(404, code, message);
}

export function serviceUnavailable(code: string, message: string): HttpError {
  return new HttpError(503, code, message);
}
