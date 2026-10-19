import type { ContractSummaryRecord } from "./types.js";

/**
 * Coerces a Prisma `JsonValue` into a string array. Uploaded/engine data is
 * never trusted to have the shape we wrote, so unknown values degrade safely.
 */
export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

/** Coerces a stored JSON summary column into a typed contract summary. */
export function toContractSummary(value: unknown): ContractSummaryRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { openapi: "unknown", warnings: [] };
  }

  const record = value as Record<string, unknown>;
  return {
    openapi: typeof record.openapi === "string" ? record.openapi : "unknown",
    ...(typeof record.title === "string" ? { title: record.title } : {}),
    ...(typeof record.version === "string" ? { version: record.version } : {}),
    warnings: toStringArray(record.warnings),
  };
}
