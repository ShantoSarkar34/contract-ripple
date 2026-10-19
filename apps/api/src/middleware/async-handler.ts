import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Wraps an async route handler so rejected promises reach the error handler.
 * Express 5 does this natively, but being explicit keeps behaviour obvious and
 * independent of framework version.
 */
export function asyncHandler(
  handler: (request: Request, response: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (request, response, next) => {
    handler(request, response, next).catch(next);
  };
}
