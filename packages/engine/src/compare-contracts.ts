import { compareNormalizedContracts, DEFAULT_MAX_FINDINGS } from "./compare.js";
import { EngineError } from "./errors.js";
import { normalizeContract } from "./normalize.js";
import { DEFAULT_MAX_BYTES, parseContractInput } from "./parse.js";
import { buildComparisonResult } from "./serialize.js";
import { validateContract } from "./validate.js";
import type { ComparisonResult, CompareContractsInput } from "./types.js";

const MAX_BYTES_LIMIT = 50 * 1024 * 1024;
const MAX_FINDINGS_LIMIT = 100_000;

function positiveInteger(
  value: number | undefined,
  name: string,
  fallback: number,
  upperBound: number,
): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isInteger(value) || value <= 0 || value > upperBound) {
    throw new EngineError(
      "invalid_options",
      `${name} must be an integer between 1 and ${upperBound}`,
    );
  }
  return value;
}

/**
 * Compares two untrusted OpenAPI documents.
 *
 * Pipeline: size-limited parse -> OpenAPI validation -> normalization -> diff
 * -> conservative risk classification -> deterministic serialization.
 */
export async function compareContracts(
  input: CompareContractsInput,
): Promise<ComparisonResult> {
  const safeInput = input as CompareContractsInput | null | undefined;
  if (!safeInput || typeof safeInput !== "object") {
    throw new EngineError("invalid_options", "input must be an object");
  }

  const maxBytes = positiveInteger(
    safeInput.options?.maxBytes,
    "maxBytes",
    DEFAULT_MAX_BYTES,
    MAX_BYTES_LIMIT,
  );
  const maxFindings = positiveInteger(
    safeInput.options?.maxFindings,
    "maxFindings",
    DEFAULT_MAX_FINDINGS,
    MAX_FINDINGS_LIMIT,
  );

  const baselineRaw = parseContractInput(safeInput.baseline, "baseline", maxBytes);
  const candidateRaw = parseContractInput(safeInput.candidate, "candidate", maxBytes);

  const baselineSummary = await validateContract(baselineRaw, "baseline");
  const candidateSummary = await validateContract(candidateRaw, "candidate");

  const baseline = normalizeContract(baselineRaw, baselineSummary);
  const candidate = normalizeContract(candidateRaw, candidateSummary);

  const outcome = compareNormalizedContracts(baseline, candidate, { maxFindings });

  return buildComparisonResult(
    baselineSummary,
    candidateSummary,
    outcome.findings,
    [...baseline.limitations, ...candidate.limitations, ...outcome.limitations],
    outcome.truncated,
  );
}
