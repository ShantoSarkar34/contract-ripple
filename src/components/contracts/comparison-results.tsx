"use client";

import { Fragment, useMemo, useState } from "react";
import type {
  AnalysisRunDetailDto,
  FindingCategory,
  FindingDto,
  RiskLevel,
} from "@contract-ripple/shared";
import {
  CATEGORY_LABELS,
  CHANGE_TYPE_CLASSES,
  CHANGE_TYPE_LABELS,
  RISK_BADGE_CLASSES,
  RISK_LABELS,
  RISK_ORDER,
  methodClass,
} from "@/lib/findings";
import ReportActions from "./report-actions";

const INITIAL_VISIBLE_FINDINGS = 100;

type FindingFilters = {
  risk: RiskLevel | "all";
  category: FindingCategory | "all";
  method: string | "all";
  query: string;
};

const DEFAULT_FILTERS: FindingFilters = {
  risk: "all",
  category: "all",
  method: "all",
  query: "",
};

type SummaryCardProps = {
  label: string;
  value: number;
  className: string;
};

function SummaryCard({ label, value, className }: SummaryCardProps) {
  return (
    <div className="card p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
        {label}
      </dt>
      <dd className={`mt-1 text-2xl font-bold ${className}`}>{value}</dd>
    </div>
  );
}

function filtersAreActive(filters: FindingFilters): boolean {
  return (
    filters.risk !== "all" ||
    filters.category !== "all" ||
    filters.method !== "all" ||
    filters.query.trim().length > 0
  );
}

function matchesQuery(finding: FindingDto, query: string): boolean {
  if (query.length === 0) {
    return true;
  }
  return [
    finding.summary,
    finding.explanation,
    finding.path,
    finding.method,
    finding.operationId,
    finding.location,
    finding.before,
    finding.after,
    CATEGORY_LABELS[finding.category],
  ].some((value) => typeof value === "string" && value.toLowerCase().includes(query));
}

function FindingDetails({ finding }: { finding: FindingDto }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
          Explanation
        </p>
        <p className="mt-1 text-sm text-muted">{finding.explanation}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
          Evidence location
        </p>
        <p className="mt-1 break-all font-mono text-xs text-muted">{finding.location}</p>
      </div>

      {finding.before !== undefined || finding.after !== undefined ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {finding.before !== undefined && finding.before !== null ? (
            <div className="rounded-md border border-danger/20 bg-danger-light/60 p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-danger">
                Before
              </p>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-foreground">
                {finding.before}
              </pre>
            </div>
          ) : null}
          {finding.after !== undefined && finding.after !== null ? (
            <div className="rounded-md border border-success/20 bg-success-light/60 p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-success">
                After
              </p>
              <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-foreground">
                {finding.after}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function FindingCard({
  finding,
  expanded,
  detailId,
  onToggle,
}: {
  finding: FindingDto;
  expanded: boolean;
  detailId: string;
  onToggle: () => void;
}) {
  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`badge ${RISK_BADGE_CLASSES[finding.risk]}`}>
          {RISK_LABELS[finding.risk]}
        </span>
        <span
          className={`text-xs font-semibold ${CHANGE_TYPE_CLASSES[finding.changeType]}`}
        >
          {CHANGE_TYPE_LABELS[finding.changeType]}
        </span>
      </div>

      <p className="mt-3 text-sm font-medium text-foreground">{finding.summary}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {finding.method ? (
          <span
            className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold uppercase ${methodClass(finding.method)}`}
          >
            {finding.method}
          </span>
        ) : null}
        <span className="break-all font-mono text-xs text-foreground">
          {finding.path ?? "—"}
        </span>
      </div>

      {finding.operationId ? (
        <p className="mt-1 break-all font-mono text-[11px] text-subtle">
          operationId {finding.operationId}
        </p>
      ) : null}

      <dl className="mt-3 grid gap-2 text-xs">
        <div>
          <dt className="text-subtle">Category</dt>
          <dd className="mt-0.5 text-foreground">{CATEGORY_LABELS[finding.category]}</dd>
        </div>
        <div>
          <dt className="text-subtle">Evidence</dt>
          <dd className="mt-0.5 break-all font-mono text-[11px] text-muted">
            {finding.location}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        className="btn-secondary mt-3 w-full text-xs sm:w-auto"
        aria-expanded={expanded}
        aria-controls={detailId}
        aria-label={`${expanded ? "Hide" : "Show"} details for ${finding.summary}`}
        onClick={onToggle}
      >
        {expanded ? "Hide details" : "Show details"}
      </button>

      {expanded ? (
        <div id={detailId} className="mt-3 border-t border-line pt-3">
          <FindingDetails finding={finding} />
        </div>
      ) : null}
    </li>
  );
}

export default function ComparisonResults({ analysis }: { analysis: AnalysisRunDetailDto }) {
  const [filters, setFilters] = useState<FindingFilters>(DEFAULT_FILTERS);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_FINDINGS);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const present = new Set(analysis.findings.map((finding) => finding.category));
    return (Object.keys(CATEGORY_LABELS) as FindingCategory[]).filter((category) =>
      present.has(category),
    );
  }, [analysis.findings]);

  const methodOptions = useMemo(() => {
    const methods = new Set<string>();
    for (const finding of analysis.findings) {
      if (finding.method) {
        methods.add(finding.method.toLowerCase());
      }
    }
    return [...methods].sort((a, b) => a.localeCompare(b));
  }, [analysis.findings]);

  const filteredFindings = useMemo(() => {
    const query = filters.query.trim().toLowerCase();
    return analysis.findings.filter((finding) => {
      if (filters.risk !== "all" && finding.risk !== filters.risk) {
        return false;
      }
      if (filters.category !== "all" && finding.category !== filters.category) {
        return false;
      }
      if (filters.method !== "all" && (finding.method?.toLowerCase() ?? "") !== filters.method) {
        return false;
      }
      return matchesQuery(finding, query);
    });
  }, [analysis.findings, filters]);

  const visibleFindings = filteredFindings.slice(0, visibleCount);
  const activeFilters = filtersAreActive(filters);
  const hasMore = visibleFindings.length < filteredFindings.length;

  function updateFilter<K extends keyof FindingFilters>(
    key: K,
    value: FindingFilters[K],
  ): void {
    setFilters((current) => ({ ...current, [key]: value }));
    setVisibleCount(INITIAL_VISIBLE_FINDINGS);
    setExpandedId(null);
  }

  function clearFilters(): void {
    setFilters(DEFAULT_FILTERS);
    setVisibleCount(INITIAL_VISIBLE_FINDINGS);
    setExpandedId(null);
  }

  return (
    <section id="comparison-report" className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Comparison report
            {analysis.label ? (
              <span className="ml-2 text-sm font-normal text-subtle">
                {analysis.label}
              </span>
            ) : null}
          </h2>
          <p className="mt-1 text-xs text-subtle">
            {new Date(analysis.createdAt).toLocaleString()} · {analysis.durationMs} ms
          </p>
        </div>
        <ReportActions analysis={analysis} />
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Total changes" value={analysis.totalFindings} className="text-foreground" />
        <SummaryCard
          label="Non-breaking"
          value={analysis.nonBreakingCount}
          className="text-success"
        />
        <SummaryCard
          label="Potentially breaking"
          value={analysis.potentiallyBreakingCount}
          className="text-danger"
        />
        <SummaryCard label="Unknown" value={analysis.unknownCount} className="text-warning" />
      </dl>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="card p-3 text-sm">
          <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
            Baseline
          </dt>
          <dd className="mt-1 text-foreground">
            {analysis.baseline.contractName}
            <span className="text-subtle">
              {" "}
              · {analysis.baseline.versionLabel ?? analysis.baseline.versionId} · OpenAPI{" "}
              {analysis.baseline.openapi}
            </span>
          </dd>
        </div>
        <div className="card p-3 text-sm">
          <dt className="text-xs font-semibold uppercase tracking-wide text-subtle">
            Candidate
          </dt>
          <dd className="mt-1 text-foreground">
            {analysis.candidate.contractName}
            <span className="text-subtle">
              {" "}
              · {analysis.candidate.versionLabel ?? analysis.candidate.versionId} · OpenAPI{" "}
              {analysis.candidate.openapi}
            </span>
          </dd>
        </div>
      </dl>

      {analysis.truncated ? (
        <p className="rounded-md border border-warning/30 bg-warning-light p-3 text-sm text-warning">
          The engine stopped after the configured finding limit. Results below are truncated.
        </p>
      ) : null}

      {analysis.limitations.length > 0 ? (
        <details className="card p-4 text-sm">
          <summary className="min-h-11 cursor-pointer py-2 font-semibold text-foreground">
            Analysis limitations ({analysis.limitations.length})
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            {analysis.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {analysis.findings.length === 0 ? (
        <p className="card p-6 text-center text-sm text-subtle">
          No differences were detected between the selected versions.
        </p>
      ) : (
        <div className="space-y-3">
          <div
            role="group"
            aria-label="Finding filters"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className="text-xs font-medium text-muted">
              Risk
              <select
                className="input mt-1"
                value={filters.risk}
                onChange={(event) =>
                  updateFilter("risk", event.target.value as FindingFilters["risk"])
                }
              >
                <option value="all">All risk levels</option>
                {RISK_ORDER.filter((risk) =>
                  analysis.findings.some((finding) => finding.risk === risk),
                ).map((risk) => (
                  <option key={risk} value={risk}>
                    {RISK_LABELS[risk]}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-medium text-muted">
              Category
              <select
                className="input mt-1"
                value={filters.category}
                onChange={(event) => updateFilter("category", event.target.value as FindingFilters["category"])}
              >
                <option value="all">All categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABELS[category]}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-medium text-muted">
              Method
              <select
                className="input mt-1"
                value={filters.method}
                onChange={(event) => updateFilter("method", event.target.value)}
              >
                <option value="all">All methods</option>
                {methodOptions.map((method) => (
                  <option key={method} value={method}>
                    {method.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-medium text-muted">
              Search
              <input
                type="search"
                className="input mt-1"
                placeholder="Summary, path, or evidence"
                value={filters.query}
                onChange={(event) => updateFilter("query", event.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-subtle" aria-live="polite">
              Showing {visibleFindings.length} of {filteredFindings.length} finding(s)
              {filteredFindings.length !== analysis.findings.length
                ? `, filtered from ${analysis.findings.length}`
                : ""}
            </p>
            {activeFilters ? (
              <button
                type="button"
                className="inline-flex min-h-11 items-center text-xs font-semibold text-primary underline-offset-2 hover:underline"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {filteredFindings.length === 0 ? (
            <div className="card p-6 text-center text-sm text-subtle">
              <p>No findings match the current filters.</p>
              <button
                type="button"
                className="mt-2 inline-flex min-h-11 items-center text-xs font-semibold text-primary underline-offset-2 hover:underline"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <ul className="space-y-3 lg:hidden" aria-label="Findings">
                {visibleFindings.map((finding) => {
                  const expanded = expandedId === finding.id;
                  const detailId = `finding-card-detail-${finding.id}`;
                  return (
                    <FindingCard
                      key={finding.id}
                      finding={finding}
                      expanded={expanded}
                      detailId={detailId}
                      onToggle={() => setExpandedId(expanded ? null : finding.id)}
                    />
                  );
                })}
              </ul>

              <div
                role="region"
                aria-label="Findings table, horizontally scrollable"
                tabIndex={0}
                className="contain-paint hidden overflow-x-auto rounded-lg border border-line lg:block"
              >
                <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                  <caption className="sr-only">
                    Classified differences between the baseline and candidate contracts.
                  </caption>
                  <thead className="bg-surface-muted text-xs uppercase tracking-wide text-subtle">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold">Risk</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Change</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Method</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Path</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Category</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Summary</th>
                      <th scope="col" className="px-3 py-2 font-semibold">Evidence</th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        <span className="sr-only">Details</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {visibleFindings.map((finding) => {
                      const expanded = expandedId === finding.id;
                      return (
                        <Fragment key={finding.id}>
                          <tr className="align-top hover:bg-surface-muted">
                            <td className="px-3 py-2.5">
                              <span className={`badge ${RISK_BADGE_CLASSES[finding.risk]}`}>
                                {RISK_LABELS[finding.risk]}
                              </span>
                            </td>
                            <td className={`px-3 py-2.5 text-xs font-semibold ${CHANGE_TYPE_CLASSES[finding.changeType]}`}>
                              {CHANGE_TYPE_LABELS[finding.changeType]}
                            </td>
                            <td className="px-3 py-2.5">
                              {finding.method ? (
                                <span
                                  className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold uppercase ${methodClass(finding.method)}`}
                                >
                                  {finding.method}
                                </span>
                              ) : (
                                <span className="text-subtle">—</span>
                              )}
                            </td>
                            <td className="max-w-[220px] px-3 py-2.5">
                              <span
                                className="block truncate font-mono text-xs text-foreground"
                                title={finding.path ?? undefined}
                              >
                                {finding.path ?? "—"}
                              </span>
                              {finding.operationId ? (
                                <span
                                  className="mt-0.5 block truncate font-mono text-[11px] text-subtle"
                                  title={finding.operationId}
                                >
                                  {finding.operationId}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted">
                              {CATEGORY_LABELS[finding.category]}
                            </td>
                            <td className="max-w-[280px] px-3 py-2.5">
                              <span className="block font-medium text-foreground">
                                {finding.summary}
                              </span>
                            </td>
                            <td className="max-w-[220px] px-3 py-2.5">
                              <span
                                className="block truncate font-mono text-[11px] text-subtle"
                                title={finding.location}
                              >
                                {finding.location}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <button
                                type="button"
                                className="btn-ghost min-h-11 px-2 py-1 text-xs"
                                aria-expanded={expanded}
                                aria-controls={`finding-table-detail-${finding.id}`}
                                aria-label={`${expanded ? "Hide" : "Show"} details for ${finding.summary}`}
                                onClick={() => setExpandedId(expanded ? null : finding.id)}
                              >
                                {expanded ? "Hide" : "Details"}
                              </button>
                            </td>
                          </tr>
                          {expanded ? (
                            <tr
                              id={`finding-table-detail-${finding.id}`}
                              className="bg-surface-muted/80"
                            >
                              <td colSpan={8} className="px-3 py-4">
                                <FindingDetails finding={finding} />
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {hasMore ? (
                <button
                  type="button"
                  className="btn-secondary w-full sm:w-auto"
                  onClick={() => setVisibleCount((current) => current + INITIAL_VISIBLE_FINDINGS)}
                >
                  Show {Math.min(INITIAL_VISIBLE_FINDINGS, filteredFindings.length - visibleFindings.length)} more
                </button>
              ) : null}
            </>
          )}
        </div>
      )}
    </section>
  );
}
