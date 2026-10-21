import type { AnalysisRunDto, ProjectDto } from "@contract-ripple/shared";
import { api } from "@/lib/api";

/**
 * The dashboard deliberately reuses owner-scoped endpoints instead of adding a
 * new aggregate API. Histories are fetched per project, so the number of
 * projects inspected is capped and the view labels partial totals.
 */
export const DASHBOARD_PROJECT_LIMIT = 25;

export type DashboardProjectSummary = {
  project: ProjectDto;
  /** `null` when this project's history could not be read. */
  history: {
    analysisCount: number;
    latestAnalysis: AnalysisRunDto | null;
  } | null;
};

export type DashboardSummary = {
  projects: DashboardProjectSummary[];
  /** Total projects on the account, including ones beyond the inspection cap. */
  projectCount: number;
  contractCount: number;
  /** Sum of saved analyses for the inspected projects that loaded. */
  analysisCount: number;
  projectsWithAnalyses: number;
  latestAnalysisAt: string | null;
  capped: boolean;
  partial: boolean;
};

export async function loadDashboardSummary(): Promise<DashboardSummary> {
  const { projects } = await api.listProjects();
  const inspected = projects.slice(0, DASHBOARD_PROJECT_LIMIT);

  const histories = await Promise.allSettled(
    inspected.map((project) => api.listComparisons(project.id, { limit: 1 })),
  );

  let analysisCount = 0;
  let projectsWithAnalyses = 0;
  let latestAnalysisAt: string | null = null;
  let historyFailures = 0;

  const summaries: DashboardProjectSummary[] = inspected.map((project, index) => {
    const result = histories[index];
    if (!result || result.status === "rejected") {
      historyFailures += 1;
      return { project, history: null };
    }

    const { analyses, totalCount } = result.value;
    const latestAnalysis = analyses[0] ?? null;
    analysisCount += totalCount;
    if (totalCount > 0) {
      projectsWithAnalyses += 1;
    }
    if (latestAnalysis && (!latestAnalysisAt || latestAnalysis.createdAt > latestAnalysisAt)) {
      latestAnalysisAt = latestAnalysis.createdAt;
    }

    return { project, history: { analysisCount: totalCount, latestAnalysis } };
  });

  return {
    projects: summaries,
    projectCount: projects.length,
    contractCount: projects.reduce((total, project) => total + project.contractCount, 0),
    analysisCount,
    projectsWithAnalyses,
    latestAnalysisAt,
    capped: projects.length > inspected.length,
    partial: historyFailures > 0 || projects.length > inspected.length,
  };
}
