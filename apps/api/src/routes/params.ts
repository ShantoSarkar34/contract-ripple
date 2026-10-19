import type { Request } from "express";
import { badRequest } from "../middleware/http-error.js";

/** Reads a required route parameter, failing with a safe 400 when absent. */
export function requiredParam(request: Request, name: string): string {
  const value = request.params[name];
  if (typeof value !== "string" || value.length === 0) {
    throw badRequest("invalid_request", `Missing route parameter "${name}".`);
  }
  return value;
}
