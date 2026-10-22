import { describe, expect, it } from "vitest";
import type { AnalysisRunDto, ProjectDto } from "@contract-ripple/shared";
import { mergeRecentAnalyses } from "./history";

const project: ProjectDto = {
  id: "project-1",
  name: "Payments",
  description: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-02T10:00:00.000Z",
  contractCount: 1,
};

function analysis(id: string, createdAt: string): AnalysisRunDto {
  return {
    id,
    projectId: project.id,
    label: null,
    status: "completed",
    truncated: false,
    totalFindings: 1,
    nonBreakingCount: 1,
    potentiallyBreakingCount: 0,
    unknownCount: 0,
    durationMs: 12,
    createdAt,
    baselineVersionId: "v1",
    candidateVersionId: "v2",
    baselineVersionLabel: "v1",
    candidateVersionLabel: "v2",
  };
}

describe("mergeRecentAnalyses", () => {
  it("sorts across projects newest first and keeps the project association", () => {
    const merged = mergeRecentAnalyses([
      { project, analysis: analysis("older", "2026-10-20T10:00:00.000Z") },
      { project, analysis: analysis("newer", "2026-10-21T10:00:00.000Z") },
    ]);

    expect(merged.map((entry) => entry.analysis.id)).toEqual(["newer", "older"]);
    expect(merged[0]?.project.id).toBe(project.id);
  });

  it("applies the display cap without mutating the input", () => {
    const entries = [
      { project, analysis: analysis("a", "2026-10-21T10:00:00.000Z") },
      { project, analysis: analysis("b", "2026-10-20T10:00:00.000Z") },
    ];

    const merged = mergeRecentAnalyses(entries, 1);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.analysis.id).toBe("a");
    expect(entries.map((entry) => entry.analysis.id)).toEqual(["a", "b"]);
  });
});
