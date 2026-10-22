import type { AnalysisRunDto, ProjectDto } from "@contract-ripple/shared";
import { compareAnalysesNewestFirst } from "./analysis";

/**
 * The all-projects view reuses the existing per-project history endpoint.
 * Inspecting every project on each load would be unbounded, so both the
 * project fan-out and the merged list are explicitly capped.
 */
export const HISTORY_PROJECT_LIMIT = 25;
export const HISTORY_PER_PROJECT = 5;
export const HISTORY_MAX_ENTRIES = 75;
export const HISTORY_PAGE_SIZE = 20;

export type ProjectAnalysisEntry = {
  project: ProjectDto;
  analysis: AnalysisRunDto;
};

export function mergeRecentAnalyses(
  entries: ProjectAnalysisEntry[],
  limit: number = HISTORY_MAX_ENTRIES,
): ProjectAnalysisEntry[] {
  return [...entries]
    .sort((left, right) => compareAnalysesNewestFirst(left.analysis, right.analysis))
    .slice(0, limit);
}
