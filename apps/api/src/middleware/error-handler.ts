import type { ApiErrorResponse } from "@contract-ripple/shared";
import type { NextFunction, Request, Response } from "express";

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
