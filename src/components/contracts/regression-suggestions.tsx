"use client";

import { useState } from "react";
import type { AnalysisRunDetailDto } from "@contract-ripple/shared";
import { RISK_BADGE_CLASSES, RISK_LABELS, methodClass } from "@/lib/findings";

const INITIAL_VISIBLE_SUGGESTIONS = 20;

export default function RegressionSuggestions({
  analysis,
}: {
  analysis: AnalysisRunDetailDto;
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_SUGGESTIONS);
  const suggestions = analysis.regressionSuggestions;
  const visible = suggestions.slice(0, visibleCount);
  const withoutOperation = analysis.findings.filter(
    (finding) => !finding.method || !finding.path,
  ).length;

  return (
    <section id="regression-suggestions" className="card scroll-mt-24 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">
            5 · Regression checks
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Review prompts derived from the classified findings for each changed operation. They
            are not executable tests and do not claim that a failure has occurred.
          </p>
        </div>
        <p className="text-xs text-subtle">
          {suggestions.length} operation{suggestions.length === 1 ? "" : "s"}
        </p>
      </div>

      {suggestions.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-line-strong p-4 text-sm text-subtle">
          <p>No operation-scoped findings produced regression suggestions.</p>
          {withoutOperation > 0 ? (
            <p className="mt-1 text-xs">
              {withoutOperation} finding{withoutOperation === 1 ? "" : "s"} without a method and
              path remain available in the findings table and in report exports.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {visible.map((suggestion) => (
            <article
              key={suggestion.id}
              className="rounded-lg border border-line p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${RISK_BADGE_CLASSES[suggestion.risk]}`}>
                  {RISK_LABELS[suggestion.risk]}
                </span>
                <span
                  className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold uppercase ${methodClass(suggestion.method)}`}
                >
                  {suggestion.method}
                </span>
                <h3 className="break-all font-mono text-sm font-semibold text-foreground">
                  {suggestion.path}
                </h3>
                {suggestion.operationId ? (
                  <code className="text-xs text-subtle">
                    {suggestion.operationId}
                  </code>
                ) : null}
              </div>

              <p className="mt-2 text-sm text-muted">
                {suggestion.rationale}
              </p>

              <h4 className="mt-3 text-xs font-semibold uppercase tracking-wide text-subtle">
                Suggested checks
              </h4>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted">
                {suggestion.suggestedChecks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ul>

              {suggestion.evidence.length > 0 ? (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-xs font-semibold text-primary">
                    Evidence from {suggestion.findingIds.length} finding
                    {suggestion.findingIds.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
                    {suggestion.evidence.map((evidence, index) => (
                      <li key={`${index}:${evidence}`}>{evidence}</li>
                    ))}
                  </ul>
                  {suggestion.findingIds.length > suggestion.evidence.length ? (
                    <p className="mt-1 text-xs text-subtle">
                      {suggestion.findingIds.length - suggestion.evidence.length} more finding
                      {suggestion.findingIds.length - suggestion.evidence.length === 1
                        ? ""
                        : "s"}{" "}
                      are listed in the findings table and report export.
                    </p>
                  ) : null}
                </details>
              ) : null}
            </article>
          ))}

          {visible.length < suggestions.length ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setVisibleCount((current) => current + INITIAL_VISIBLE_SUGGESTIONS)
              }
            >
              Show {Math.min(INITIAL_VISIBLE_SUGGESTIONS, suggestions.length - visible.length)}{" "}
              more
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
