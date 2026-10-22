import type { AnalysisRunDto } from "@contract-ripple/shared";
import { Badge } from "@/components/ui/badge";

/**
 * The shared risk summary for a saved run. Failed runs are labelled as such
 * instead of presenting their empty counts as a successful review.
 */
export function AnalysisRiskBadges({ analysis }: { analysis: AnalysisRunDto }) {
  if (analysis.status === "failed") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="danger" withDot>
          Analysis failed
        </Badge>
        {analysis.truncated ? <Badge tone="warning">Truncated</Badge> : null}
      </div>
    );
  }

  if (analysis.totalFindings === 0) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral" withDot>
          No changes
        </Badge>
        {analysis.truncated ? <Badge tone="warning">Truncated</Badge> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {analysis.potentiallyBreakingCount > 0 ? (
        <Badge tone="danger">{analysis.potentiallyBreakingCount} potentially breaking</Badge>
      ) : null}
      {analysis.unknownCount > 0 ? (
        <Badge tone="warning">{analysis.unknownCount} unknown</Badge>
      ) : null}
      {analysis.nonBreakingCount > 0 ? (
        <Badge tone="success">{analysis.nonBreakingCount} non-breaking</Badge>
      ) : null}
      {analysis.truncated ? <Badge tone="warning">Truncated</Badge> : null}
    </div>
  );
}
