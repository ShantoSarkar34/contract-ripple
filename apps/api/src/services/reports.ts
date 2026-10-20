import type {
  AnalysisReportDto,
  AnalysisRunDetailDto,
  ReportSourceSnapshotDto,
  SourceSnapshotDetailDto,
} from "@contract-ripple/shared";
import type { Repository } from "../db/types.js";
import { notFound } from "../middleware/http-error.js";
import { toAnalysisRunDetailDto, toSourceSnapshotDetailDto } from "./serialization.js";

const REPORT_SCHEMA_VERSION = "contract-ripple.report.v1" as const;

const REPORT_NOTES = [
  "Regression suggestions are review prompts derived from persisted findings; they are not generated executable tests and do not claim the API is broken.",
  "Static source analysis only detects statically resolvable API calls. Dynamic URLs, custom wrappers, generated clients, and runtime behavior may not be detected.",
  "The report includes the latest source analysis attached to this comparison, if one exists.",
] as const;

function toReportSourceSnapshot(
  snapshot: SourceSnapshotDetailDto,
): ReportSourceSnapshotDto {
  const { files: _files, ...reportSnapshot } = snapshot;
  return reportSnapshot;
}

export type GetReportOptions = {
  now?: Date;
};

export async function getComparisonReport(
  repository: Repository,
  comparisonId: string,
  options: GetReportOptions = {},
): Promise<AnalysisReportDto> {
  const run = await repository.getAnalysisRun(comparisonId);
  if (!run) {
    throw notFound("comparison_not_found", "Comparison not found.");
  }

  const project = await repository.getProject(run.projectId);
  if (!project) {
    throw notFound("project_not_found", "Project not found.");
  }

  const detail = toAnalysisRunDetailDto(run);
  const snapshots = await repository.listSourceSnapshotsByAnalysisRun(run.id);
  const latest = snapshots[0];
  let reportSnapshot: ReportSourceSnapshotDto | null = null;

  if (latest) {
    const snapshot = await repository.getSourceSnapshot(latest.id);
    if (snapshot) {
      reportSnapshot = toReportSourceSnapshot(toSourceSnapshotDetailDto(snapshot));
    }
  }

  return buildAnalysisReport(detail, project.name, reportSnapshot, snapshots.length, options);
}

export function buildAnalysisReport(
  detail: AnalysisRunDetailDto,
  projectName: string,
  sourceSnapshot: ReportSourceSnapshotDto | null,
  availableSnapshotCount: number,
  options: GetReportOptions = {},
): AnalysisReportDto {
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: (options.now ?? new Date()).toISOString(),
    project: { id: detail.projectId, name: projectName },
    comparison: {
      id: detail.id,
      projectId: detail.projectId,
      label: detail.label,
      status: detail.status,
      truncated: detail.truncated,
      totalFindings: detail.totalFindings,
      nonBreakingCount: detail.nonBreakingCount,
      potentiallyBreakingCount: detail.potentiallyBreakingCount,
      unknownCount: detail.unknownCount,
      durationMs: detail.durationMs,
      createdAt: detail.createdAt,
      baselineVersionId: detail.baselineVersionId,
      candidateVersionId: detail.candidateVersionId,
      baselineVersionLabel: detail.baselineVersionLabel,
      candidateVersionLabel: detail.candidateVersionLabel,
    },
    baseline: detail.baseline,
    candidate: detail.candidate,
    findings: detail.findings,
    regressionSuggestions: detail.regressionSuggestions,
    sourceAnalysis: {
      availableSnapshotCount,
      includedSnapshotId: sourceSnapshot?.id ?? null,
      snapshot: sourceSnapshot,
    },
    limitations: detail.limitations,
    notes: [...REPORT_NOTES],
  };
}

/* -------------------------------------------------------------------------- */
/* Readable Markdown export                                                   */
/* -------------------------------------------------------------------------- */

const RISK_LABELS = {
  non_breaking: "Non-breaking",
  potentially_breaking: "Potentially breaking",
  unknown: "Unknown",
} as const;

function inlineText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/([\\`*_{}[\]<>#|])/g, "\\$1")
    .trim();
}

function code(value: string): string {
  const longestRun = Math.max(0, ...(value.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(longestRun + 1);
  const pad = value.startsWith("`") || value.endsWith("`") ? " " : "";
  return `${fence}${pad}${value}${pad}${fence}`;
}

function codeFence(value: string, language = ""): string {
  const longestRun = Math.max(0, ...(value.match(/`+/g) ?? []).map((run) => run.length));
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}${language}\n${value}\n${fence}`;
}

function bulletList(values: readonly string[], emptyText: string): string {
  if (values.length === 0) {
    return emptyText;
  }
  return values.map((value) => `- ${inlineText(value)}`).join("\n");
}

function operationLabel(method: string | null, path: string | null): string {
  if (!method || !path) {
    return "Contract-level";
  }
  return `${method.toUpperCase()} ${path}`;
}

export function renderMarkdownReport(report: AnalysisReportDto): string {
  const lines: string[] = [];
  const { comparison } = report;

  lines.push("# ContractRipple analysis report");
  lines.push("");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Project: ${inlineText(report.project.name)}`);
  lines.push(
    `Comparison: ${inlineText(comparison.label ?? comparison.id)} (${comparison.status})`,
  );
  lines.push(
    `Baseline: ${inlineText(report.baseline.contractName)} · ${inlineText(report.baseline.versionLabel ?? report.baseline.versionId)} · OpenAPI ${inlineText(report.baseline.openapi)}`,
  );
  lines.push(
    `Candidate: ${inlineText(report.candidate.contractName)} · ${inlineText(report.candidate.versionLabel ?? report.candidate.versionId)} · OpenAPI ${inlineText(report.candidate.openapi)}`,
  );
  lines.push(
    `Generated in ${comparison.durationMs} ms${comparison.truncated ? " · findings truncated by the engine" : ""}`,
  );
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("| --- | ---: |");
  lines.push(`| Total changes | ${comparison.totalFindings} |`);
  lines.push(`| Non-breaking | ${comparison.nonBreakingCount} |`);
  lines.push(`| Potentially breaking | ${comparison.potentiallyBreakingCount} |`);
  lines.push(`| Unknown | ${comparison.unknownCount} |`);
  lines.push(`| Regression suggestions | ${report.regressionSuggestions.length} |`);
  lines.push("");

  lines.push("## Limitations");
  lines.push("");
  lines.push(bulletList(report.limitations, "No comparison limitations were recorded."));
  lines.push("");

  lines.push("## Regression suggestions");
  lines.push("");
  lines.push(
    "> These are review prompts derived from the persisted findings, not executable tests. They do not claim that a failure has occurred.",
  );
  lines.push("");

  if (report.regressionSuggestions.length === 0) {
    lines.push(
      "No operation-scoped findings produced regression suggestions. Findings without a method and path are still listed below.",
    );
  } else {
    report.regressionSuggestions.forEach((suggestion, index) => {
      lines.push(
        `### ${index + 1}. ${inlineText(suggestion.title)}`,
      );
      lines.push("");
      lines.push(`- Risk: ${RISK_LABELS[suggestion.risk]}`);
      lines.push(
        `- Operation: ${code(`${suggestion.method.toUpperCase()} ${suggestion.path}`)}`,
      );
      if (suggestion.operationId) {
        lines.push(`- Operation ID: ${code(suggestion.operationId)}`);
      }
      lines.push(`- Rationale: ${inlineText(suggestion.rationale)}`);
      lines.push("- Suggested checks:");
      suggestion.suggestedChecks.forEach((check) => {
        lines.push(`  - ${inlineText(check)}`);
      });
      if (suggestion.evidence.length > 0) {
        lines.push("- Evidence:");
        suggestion.evidence.forEach((evidence) => {
          lines.push(`  - ${inlineText(evidence)}`);
        });
        if (suggestion.findingIds.length > suggestion.evidence.length) {
          lines.push(
            `  - ${suggestion.findingIds.length - suggestion.evidence.length} additional finding(s) are listed in the findings section.`,
          );
        }
      }
      lines.push("");
    });
  }

  lines.push("## Source analysis");
  lines.push("");
  const source = report.sourceAnalysis;
  if (!source.snapshot) {
    lines.push("No source analysis is attached to this comparison.");
  } else {
    const snapshot = source.snapshot;
    const sourceLabel =
      snapshot.sourceType === "github"
        ? `${snapshot.repository ?? "GitHub repository"}${snapshot.ref ? ` @ ${snapshot.ref}` : ""}`
        : "ZIP upload";
    lines.push(`Latest source analysis: ${inlineText(sourceLabel)}`);
    lines.push("");
    lines.push(`- Snapshot: ${code(snapshot.id)}`);
    lines.push(`- Created: ${snapshot.createdAt}`);
    lines.push(
      `- Files scanned: ${snapshot.fileCount} · skipped: ${snapshot.skippedCount} · bytes: ${snapshot.totalBytes}`,
    );
    lines.push(`- Matched calls: ${snapshot.impactCount}`);
    lines.push(`- Snapshots available for this comparison: ${source.availableSnapshotCount}`);
    lines.push("");
    lines.push(
      "> Only the latest source snapshot is included in this export. Older snapshots remain available in the source panel.",
    );
    lines.push("");

    if (snapshot.impacts.length === 0) {
      lines.push(
        "No affected API calls were detected in the scanned source. Dynamic URLs, custom wrappers, and generated clients may still be affected.",
      );
    } else {
      lines.push("### Source impacts");
      lines.push("");
      snapshot.impacts.forEach((impact, index) => {
        lines.push(
          `#### ${index + 1}. ${code(operationLabel(impact.matchedMethod, impact.matchedPath))}`,
        );
        lines.push("");
        lines.push(`- File: ${code(`${impact.filePath}:${impact.line}:${impact.column}`)}`);
        lines.push(`- Detected call: ${code(impact.call)}`);
        lines.push(
          `- Request call: ${code(operationLabel(impact.method, impact.path))}`,
        );
        if (impact.operationId) {
          lines.push(`- Operation ID: ${code(impact.operationId)}`);
        }
        lines.push(`- Confidence: ${impact.confidence}`);
        lines.push(`- Evidence: ${inlineText(impact.evidence)}`);
        lines.push("");
        lines.push(codeFence(impact.snippet, "ts"));
        lines.push("");
      });
    }
    if (snapshot.limitations.length > 0) {
      lines.push("### Source limitations");
      lines.push("");
      lines.push(bulletList(snapshot.limitations, ""));
      lines.push("");
    }
  }
  lines.push("");

  lines.push(`## Findings (${report.findings.length})`);
  lines.push("");
  if (report.findings.length === 0) {
    lines.push("No differences were detected between the selected versions.");
  } else {
    lines.push(
      "| # | Risk | Change | Category | Operation | Summary | Evidence |",
    );
    lines.push("| ---: | --- | --- | --- | --- | --- | --- |");
    report.findings.forEach((finding, index) => {
      lines.push(
        `| ${index + 1} | ${RISK_LABELS[finding.risk]} | ${inlineText(finding.changeType)} | ${inlineText(finding.category)} | ${inlineText(operationLabel(finding.method, finding.path))} | ${inlineText(finding.summary)} | ${inlineText(finding.location)} |`,
      );
    });
    lines.push("");

    const withChanges = report.findings.filter(
      (finding) => finding.before !== null || finding.after !== null,
    );
    if (withChanges.length > 0) {
      lines.push("### Evidence changes");
      lines.push("");
      withChanges.forEach((finding, index) => {
        lines.push(
          `#### ${index + 1}. ${inlineText(finding.summary)}`,
        );
        lines.push("");
        lines.push(
          `- Operation: ${code(operationLabel(finding.method, finding.path))} · Risk: ${RISK_LABELS[finding.risk]}`,
        );
        lines.push(`- Evidence location: ${code(finding.location)}`);
        lines.push("");
        if (finding.before !== null) {
          lines.push("Before:");
          lines.push("");
          lines.push(codeFence(finding.before, "json"));
          lines.push("");
        }
        if (finding.after !== null) {
          lines.push("After:");
          lines.push("");
          lines.push(codeFence(finding.after, "json"));
          lines.push("");
        }
      });
    }
  }

  lines.push("## Notes");
  lines.push("");
  lines.push(bulletList(report.notes, "No additional notes."));
  lines.push("");

  return `${lines.join("\n").trimEnd()}\n`;
}
