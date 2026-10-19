import type {
  ComparisonResult,
  ComparisonSummary,
  ContractSummary,
  Finding,
} from "./types.js";

export function summarizeFindings(findings: Finding[]): ComparisonSummary {
  let nonBreaking = 0;
  let potentiallyBreaking = 0;
  let unknown = 0;

  for (const finding of findings) {
    if (finding.risk === "non_breaking") {
      nonBreaking += 1;
    } else if (finding.risk === "potentially_breaking") {
      potentiallyBreaking += 1;
    } else {
      unknown += 1;
    }
  }

  return {
    total: findings.length,
    nonBreaking,
    potentiallyBreaking,
    unknown,
  };
}

export function buildComparisonResult(
  baseline: ContractSummary,
  candidate: ContractSummary,
  findings: Finding[],
  limitations: string[],
  truncated: boolean,
): ComparisonResult {
  return {
    baseline,
    candidate,
    findings,
    summary: summarizeFindings(findings),
    limitations: [...new Set(limitations)].sort(),
    truncated,
  };
}
