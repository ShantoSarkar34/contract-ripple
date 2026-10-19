import type { ZodType } from "zod";
import { badRequest } from "./http-error.js";

export type ValidationIssue = {
  path: string;
  message: string;
};

/**
 * Parses untrusted input with a Zod schema and converts failures into a
 * `validation_error` HTTP error with safe field-level details.
 */
export function parseWithSchema<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    const issues: ValidationIssue[] = result.error.issues.slice(0, 20).map((issue) => ({
      path: issue.path.map((segment) => String(segment)).join("."),
      message: issue.message,
    }));
    throw badRequest("validation_error", "Request validation failed.", issues);
  }

  return result.data;
}
