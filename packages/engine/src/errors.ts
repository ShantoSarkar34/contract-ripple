export type EngineErrorCode =
  | "empty_input"
  | "input_too_large"
  | "input_too_deep"
  | "circular_input"
  | "invalid_json"
  | "invalid_yaml"
  | "invalid_openapi"
  | "unsupported_version"
  | "invalid_options";

/**
 * A safe, serializable engine failure. Messages are intended for API responses
 * and must never contain raw document contents or stack traces.
 */
export class EngineError extends Error {
  readonly code: EngineErrorCode;
  readonly details: string[];

  constructor(code: EngineErrorCode, message: string, details: string[] = []) {
    super(message);
    this.name = "EngineError";
    this.code = code;
    this.details = details;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Parser libraries can echo user input in error messages. Keep messages short
 * and single-line so callers can return them without leaking large excerpts.
 */
export function sanitizeMessage(message: string, maxLength = 500): string {
  return message.replace(/\s+/g, " ").trim().slice(0, maxLength);
}
