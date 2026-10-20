import type { ChangedOperation, HttpMethod, SourceConfidence } from "./types.js";
import { SUPPORTED_SOURCE_EXTENSIONS } from "./types.js";

/** Directory names that never contain application source worth analyzing. */
const IGNORED_DIRECTORY_NAMES = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "vendor",
  "out",
  ".turbo",
  ".cache",
]);

export function hasIgnoredDirectory(path: string): boolean {
  const segments = path.replace(/\\/g, "/").split("/");
  return segments
    .slice(0, -1)
    .some((segment) => IGNORED_DIRECTORY_NAMES.has(segment.toLowerCase()));
}

export function isSupportedSourcePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  return SUPPORTED_SOURCE_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

export function isIgnoredSourcePath(path: string): boolean {
  return hasIgnoredDirectory(path.replace(/^\.?\//, ""));
}

/**
 * Normalizes a path found in source code. Absolute URLs are reduced to their
 * pathname, query strings and fragments are dropped, and duplicate/trailing
 * slashes are removed. Returns `null` when the value cannot be a path.
 */
export function normalizeCallPath(raw: string): string | null {
  let value = raw.trim();
  if (value.length === 0 || /[\s\r\n]/.test(value)) {
    return null;
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      return null;
    }
  }

  value = value.split("?")[0] ?? "";
  value = value.split("#")[0] ?? "";

  if (value.length === 0) {
    return "/";
  }
  if (!value.startsWith("/")) {
    value = `/${value}`;
  }

  value = value.replace(/\/{2,}/g, "/");
  if (value.length > 1) {
    value = value.replace(/\/+$/, "");
  }
  return value;
}

export function splitPath(path: string): string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}

/** True for OpenAPI `{param}`, client `:param`, and template `{}` segments. */
export function isDynamicSegment(segment: string): boolean {
  const value = segment.trim();
  return (
    value === "{}" ||
    (value.startsWith("{") && value.endsWith("}")) ||
    /^:[A-Za-z_$][\w$]*$/.test(value)
  );
}

function segmentsMatch(left: string, right: string): boolean {
  if (isDynamicSegment(left) || isDynamicSegment(right)) {
    return true;
  }
  return left === right;
}

function normalizeOperationPath(path: string): string {
  let value = path.trim();
  if (!value.startsWith("/")) {
    value = `/${value}`;
  }
  value = value.replace(/\/{2,}/g, "/");
  if (value.length > 1) {
    value = value.replace(/\/+$/, "");
  }
  return value;
}

export type OperationMatch = {
  operation: ChangedOperation;
  confidence: SourceConfidence;
};

/**
 * Matches a detected call path against changed operations. Exact normalized
 * matches win; otherwise a suffix match (for example `/api/pets` against
 * `/pets`) is accepted with lower confidence. Static segments are compared
 * case-sensitively.
 */
export function matchOperation(
  method: HttpMethod,
  path: string,
  operations: readonly ChangedOperation[],
): OperationMatch | null {
  const callSegments = splitPath(path);
  const candidates = operations
    .filter((operation) => operation.method.toLowerCase() === method)
    .map((operation) => ({
      operation,
      path: normalizeOperationPath(operation.path),
    }))
    .filter((candidate) => candidate.operation.path.length > 0);

  const exact = candidates
    .filter((candidate) => {
      const operationSegments = splitPath(candidate.path);
      return (
        operationSegments.length === callSegments.length &&
        operationSegments.every((segment, index) =>
          segmentsMatch(segment, callSegments[index] ?? ""),
        )
      );
    })
    .sort((left, right) => splitPath(right.path).length - splitPath(left.path).length)[0];

  if (exact) {
    return { operation: exact.operation, confidence: "high" };
  }

  const suffix = candidates
    .filter((candidate) => {
      const operationSegments = splitPath(candidate.path);
      if (operationSegments.length === 0 || operationSegments.length >= callSegments.length) {
        return false;
      }
      const offset = callSegments.length - operationSegments.length;
      return operationSegments.every((segment, index) =>
        segmentsMatch(segment, callSegments[offset + index] ?? ""),
      );
    })
    .sort((left, right) => splitPath(right.path).length - splitPath(left.path).length)[0];

  return suffix ? { operation: suffix.operation, confidence: "medium" } : null;
}
