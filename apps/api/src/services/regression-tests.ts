import type {
  FindingCategory,
  FindingDto,
  RegressionSuggestionDto,
  RiskLevel,
} from "@contract-ripple/shared";

const RISK_RANK: Record<RiskLevel, number> = {
  potentially_breaking: 0,
  unknown: 1,
  non_breaking: 2,
};

const RISK_LABELS: Record<RiskLevel, string> = {
  potentially_breaking: "potentially breaking",
  unknown: "unknown",
  non_breaking: "non-breaking",
};

/** Keep suggestion payloads bounded even when an analysis is truncated at 5,000 findings. */
const MAX_EVIDENCE_PER_SUGGESTION = 20;

function checkForFinding(finding: FindingDto): string {
  const category: FindingCategory = finding.category;

  switch (category) {
    case "operation":
      if (finding.changeType === "removed") {
        return "Exercise the client path that used this operation and confirm it fails gracefully or has been removed.";
      }
      if (finding.changeType === "added") {
        return "Add a smoke test for the new operation if the client adopts it.";
      }
      return "Re-run the client integration test for this operation against the candidate contract.";
    case "operation_id":
      return "Update generated or hand-written method references and confirm the renamed operation still resolves.";
    case "parameter":
      return "Exercise the changed parameter set, including any newly required values, and assert the request behavior.";
    case "request_body":
      return "Send a representative request body that covers the changed schema and assert the client request behavior.";
    case "response":
      return "Parse a representative response for the changed response definition and assert the client handles it.";
    case "required_property":
      return "Add the changed required property to the relevant request or response fixture and assert handling.";
    case "schema_property":
      return "Update the relevant fixture for the changed property and assert the client mapping still works.";
    case "reference":
      return "Resolve the affected reference with a representative payload and assert the client behaves correctly.";
    case "combinator":
      return "Exercise the affected composition branch (oneOf/anyOf/allOf) with a representative payload.";
    default:
      return "Re-run the regression test for the affected operation against the candidate contract.";
  }
}

function highestRisk(findings: readonly FindingDto[]): RiskLevel {
  let risk: RiskLevel = "non_breaking";
  for (const finding of findings) {
    if (RISK_RANK[finding.risk] < RISK_RANK[risk]) {
      risk = finding.risk;
    }
  }
  return risk;
}

/**
 * Builds review prompts from persisted findings. Only operation-scoped findings
 * (method + path) can produce a suggestion; nothing is inferred beyond those
 * findings, and no executable test code or expected status code is fabricated.
 */
export function generateRegressionSuggestions(
  findings: readonly FindingDto[],
): RegressionSuggestionDto[] {
  type Group = {
    method: string;
    path: string;
    operationId: string | null;
    findings: FindingDto[];
  };

  const groups = new Map<string, Group>();

  for (const finding of findings) {
    if (!finding.method || !finding.path) {
      continue;
    }
    const method = finding.method.toLowerCase();
    const key = `${method} ${finding.path}`;
    const existing = groups.get(key);
    if (existing) {
      existing.findings.push(finding);
      existing.operationId ??= finding.operationId;
      continue;
    }
    groups.set(key, {
      method,
      path: finding.path,
      operationId: finding.operationId,
      findings: [finding],
    });
  }

  return [...groups.values()]
    .map((group): RegressionSuggestionDto => {
      const risk = highestRisk(group.findings);
      const suggestedChecks = [
        ...new Set(group.findings.map((finding) => checkForFinding(finding))),
      ];
      const evidence = group.findings
        .slice(0, MAX_EVIDENCE_PER_SUGGESTION)
        .map((finding) => `${finding.summary} (${finding.location})`);
      const count = group.findings.length;

      return {
        id: `suggestion:${group.method}:${group.path}`,
        method: group.method,
        path: group.path,
        operationId: group.operationId,
        risk,
        title: `Regression checks for ${group.method.toUpperCase()} ${group.path}`,
        rationale: `Derived from ${count} classified finding${count === 1 ? "" : "s"} for this operation; highest risk: ${RISK_LABELS[risk]}.`,
        findingIds: group.findings.map((finding) => finding.id),
        evidence,
        suggestedChecks,
      };
    })
    .sort(
      (left, right) =>
        RISK_RANK[left.risk] - RISK_RANK[right.risk] ||
        left.method.localeCompare(right.method) ||
        left.path.localeCompare(right.path),
    );
}
