"use client";

import Link from "next/link";
import type { AnalysisRunDto } from "@contract-ripple/shared";
import { AnalysisRiskBadges } from "@/components/workspace/analysis-badges";
import { analysisRange, analysisTitle, formatDuration } from "@/lib/analysis";
import { formatDateTime, formatRelativeTime } from "@/lib/format";

/**
 * A single saved analysis in a list. The whole row is one link, so project
 * names inside it are plain text rather than nested anchors.
 */
export function AnalysisRow({
  analysis,
  href,
  projectName,
}: {
  analysis: AnalysisRunDto;
  href: string;
  projectName?: string;
}) {
  const title = analysisTitle(analysis);
  const range = analysisRange(analysis);

  return (
    <li>
      <Link
        href={href}
        className="group flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-primary/40 hover:bg-surface-muted sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {projectName ? (
              <span className="truncate text-xs font-semibold uppercase tracking-wide text-accent">
                {projectName}
              </span>
            ) : null}
            <span className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
              {title}
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-subtle">
            {title !== range ? `${range} · ` : ""}
            {formatDuration(analysis.durationMs)} ·{" "}
            <span title={formatDateTime(analysis.createdAt)}>
              {formatRelativeTime(analysis.createdAt)}
            </span>
          </p>
          <div className="mt-2">
            <AnalysisRiskBadges analysis={analysis} />
          </div>
        </div>
        <span
          aria-hidden="true"
          className="shrink-0 text-sm font-medium text-primary sm:pl-4"
        >
          Open analysis →
        </span>
      </Link>
    </li>
  );
}
