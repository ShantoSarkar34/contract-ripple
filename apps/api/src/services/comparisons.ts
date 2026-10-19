import { compareContracts } from "@contract-ripple/engine";
import type {
  AnalysisRunDetailDto,
  AnalysisRunDto,
  CreateComparisonRequest,
} from "@contract-ripple/shared";
import type { Repository } from "../db/types.js";
import { badRequest, notFound } from "../middleware/http-error.js";
import { toAnalysisRunDetailDto, toAnalysisRunDto } from "./serialization.js";

export async function createComparison(
  repository: Repository,
  projectId: string,
  input: CreateComparisonRequest,
): Promise<AnalysisRunDetailDto> {
  const project = await repository.getProject(projectId);
  if (!project) {
    throw notFound("project_not_found", "Project not found.");
  }

  const baseline = await repository.getContractVersion(input.baselineVersionId);
  if (!baseline) {
    throw notFound("baseline_version_not_found", "Baseline contract version not found.");
  }

  const candidate = await repository.getContractVersion(input.candidateVersionId);
  if (!candidate) {
    throw notFound("candidate_version_not_found", "Candidate contract version not found.");
  }

  if (
    baseline.contract.projectId !== projectId ||
    candidate.contract.projectId !== projectId
  ) {
    throw badRequest(
      "version_project_mismatch",
      "Both contract versions must belong to the same project.",
    );
  }

  const startedAt = Date.now();
  const result = await compareContracts({
    baseline: { content: baseline.rawContent, format: baseline.format },
    candidate: { content: candidate.rawContent, format: candidate.format },
  });
  const durationMs = Date.now() - startedAt;

  const run = await repository.createAnalysisRun({
    projectId,
    baselineVersionId: baseline.id,
    candidateVersionId: candidate.id,
    label: input.label,
    truncated: result.truncated,
    totalFindings: result.summary.total,
    nonBreakingCount: result.summary.nonBreaking,
    potentiallyBreakingCount: result.summary.potentiallyBreaking,
    unknownCount: result.summary.unknown,
    durationMs,
    limitations: result.limitations,
    baselineSummary: result.baseline,
    candidateSummary: result.candidate,
    findings: result.findings.map((finding) => ({
      engineId: finding.id,
      category: finding.category,
      changeType: finding.changeType,
      risk: finding.risk,
      path: finding.path,
      method: finding.method,
      operationId: finding.operationId,
      location: finding.location,
      summary: finding.summary,
      explanation: finding.explanation,
      before: finding.before,
      after: finding.after,
    })),
  });

  const detail = await repository.getAnalysisRun(run.id);
  if (!detail) {
    throw new Error("Analysis run could not be read back after creation.");
  }
  return toAnalysisRunDetailDto(detail);
}

export async function listComparisons(
  repository: Repository,
  projectId: string,
): Promise<AnalysisRunDto[]> {
  const project = await repository.getProject(projectId);
  if (!project) {
    throw notFound("project_not_found", "Project not found.");
  }

  const runs = await repository.listAnalysisRunsByProject(projectId);
  return runs.map(toAnalysisRunDto);
}

export async function getComparison(
  repository: Repository,
  comparisonId: string,
): Promise<AnalysisRunDetailDto> {
  const run = await repository.getAnalysisRun(comparisonId);
  if (!run) {
    throw notFound("comparison_not_found", "Comparison not found.");
  }
  return toAnalysisRunDetailDto(run);
}
