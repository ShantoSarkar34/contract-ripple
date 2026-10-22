import type { AnalysisRunDto } from "@contract-ripple/shared";

type AnalysisLabels = Pick<
  AnalysisRunDto,
  "label" | "baselineVersionLabel" | "candidateVersionLabel"
>;

/**
 * Human-readable title for a saved run. A user-provided label wins; otherwise
 * the version labels are the only truthful description we have.
 */
export function analysisTitle(run: AnalysisLabels): string {
  const label = run.label?.trim();
  if (label) {
    return label;
  }
  return analysisRange(run);
}

export function analysisRange(run: AnalysisLabels): string {
  const baseline = run.baselineVersionLabel?.trim() || "Baseline";
  const candidate = run.candidateVersionLabel?.trim() || "Candidate";
  return `${baseline} → ${candidate}`;
}

export function formatDuration(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "Unknown duration";
  }
  if (durationMs < 1000) {
    return `${Math.round(durationMs)} ms`;
  }
  return `${(durationMs / 1000).toFixed(1)} s`;
}

export function compareAnalysesNewestFirst(
  left: Pick<AnalysisRunDto, "createdAt" | "id">,
  right: Pick<AnalysisRunDto, "createdAt" | "id">,
): number {
  const delta = Date.parse(right.createdAt) - Date.parse(left.createdAt);
  return Number.isNaN(delta) || delta === 0 ? left.id.localeCompare(right.id) : delta;
}
