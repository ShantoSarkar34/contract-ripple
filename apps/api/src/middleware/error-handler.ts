import type { ApiErrorResponse } from "@contract-ripple/shared";
import { EngineError } from "@contract-ripple/engine";
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./http-error.js";

const ENGINE_ERROR_STATUS: Record<string, number> = {
  empty_input: 400,
  input_too_large: 413,
  input_too_deep: 400,
  circular_input: 400,
  invalid_json: 400,
  invalid_yaml: 400,
  invalid_openapi: 422,
  unsupported_version: 422,
  invalid_options: 400,
};

export function notFoundHandler(request: Request, response: Response): void {
  const body: ApiErrorResponse = {
    error: {
      code: "not_found",
      message: `Route ${request.method} ${request.path} was not found.`,
    },
  };

  response.status(404).json(body);
}

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void {
  if (error instanceof HttpError) {
    const body: ApiErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    };
    response.status(error.status).json(body);
    return;
  }

  if (error instanceof EngineError) {
    const status = ENGINE_ERROR_STATUS[error.code] ?? 400;
    const body: ApiErrorResponse = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details.length === 0 ? {} : { details: error.details }),
      },
    };
    response.status(status).json(body);
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";

  // Never leak stack traces or sensitive payloads to clients in production.
  if (isProduction) {
    console.error("[api] unhandled error:", error instanceof Error ? error.name : typeof error);
  } else {
    console.error("[api] unhandled error:", error);
  }

  const message =
    !isProduction && error instanceof Error ? error.message : "Unexpected server error.";

  const body: ApiErrorResponse = {
    error: {
      code: "internal_error",
      message,
    },
  };

  response.status(500).json(body);
}
