"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AnalysisRunDto, RiskLevel } from "@contract-ripple/shared";
import { AuthGate } from "@/components/workspace/auth-gate";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SkeletonCard } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { ApiRequestError } from "@/lib/api";
import {
  DASHBOARD_PROJECT_LIMIT,
  loadDashboardSummary,
  type DashboardSummary,
} from "@/lib/dashboard";
import { formatDateTime, formatRelativeTime, pluralize } from "@/lib/format";
import { RISK_LABELS, RISK_ORDER } from "@/lib/findings";

const RISK_TONE: Record<RiskLevel, "danger" | "warning" | "success"> = {
  potentially_breaking: "danger",
  unknown: "warning",
  non_breaking: "success",
};

const RISK_DESCRIPTIONS: Record<RiskLevel, string> = {
  potentially_breaking:
    "A change that may break existing integrations. Review the evidence before shipping.",
  unknown: "Compatibility could not be determined from the change alone. Review manually.",
  non_breaking: "A change expected to remain compatible with existing integrations.",
};

type LoadState = "loading" | "ready" | "error";

function messageFor(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.message;
  }
  return error instanceof Error ? error.message : "Could not load your dashboard.";
}

function AnalysisSummary({ analysis }: { analysis: AnalysisRunDto }) {
  if (analysis.status === "failed") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="danger" withDot>
          Analysis failed
        </Badge>
        <span className="text-xs text-subtle">The stored run did not complete.</span>
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
        <Badge tone="danger">
          {analysis.potentiallyBreakingCount} potentially breaking
        </Badge>
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

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="card p-4">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-3 h-7 w-12" />
            <div className="skeleton mt-3 h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

function DashboardBody() {
  const [state, setState] = useState<LoadState>("loading");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    loadDashboardSummary()
      .then((data) => {
        if (!active) {
          return;
        }
        setSummary(data);
        setState("ready");
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }
        setError(messageFor(loadError));
        setState("error");
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  function retry() {
    setState("loading");
    setError(null);
    setReloadKey((current) => current + 1);
  }

  const projects = summary?.projects ?? [];
  const hasProjects = (summary?.projectCount ?? 0) > 0;
  const someHistoriesUnavailable = projects.some((project) => project.history === null);
  const analysesCaption = summary?.capped
    ? "For inspected projects"
    : someHistoriesUnavailable
      ? "For projects with available history"
      : "Across all projects";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8">
      <PageHeader
        eyebrow="Workspace"
        title="Dashboard"
        description="A live overview of the projects, contracts, and saved analyses in your account."
        actions={
          <Link href="/contracts" className="btn-primary whitespace-nowrap">
            Open contract workspace
          </Link>
        }
      />

      <div className="mt-6 space-y-6">
        {state === "loading" ? (
          <>
            <p className="sr-only" role="status" aria-live="polite">
              Loading your dashboard…
            </p>
            <DashboardSkeleton />
          </>
        ) : null}

        {state === "error" ? (
          <Alert tone="danger" title="Could not load your dashboard" live>
            <p>{error}</p>
            <button type="button" className="btn-secondary mt-3" onClick={retry}>
              Retry
            </button>
          </Alert>
        ) : null}

        {state === "ready" && summary ? (
          <>
            {summary.partial ? (
              <Alert tone="info" title="Partial overview">
                {summary.capped
                  ? `Saved-analysis totals cover ${summary.projects.length} of ${summary.projectCount} projects. `
                  : ""}
                {projects.some((project) => project.history === null)
                  ? "Some project histories could not be loaded; their analyses are not counted below."
                  : ""}
              </Alert>
            ) : null}

            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="card p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Projects</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {summary.projectCount}
                </dd>
                <dd className="mt-1 text-xs text-subtle">
                  {summary.capped
                    ? `${summary.projectsWithAnalyses} of ${summary.projects.length} inspected projects have saved analyses`
                    : `${pluralize(summary.projectsWithAnalyses, "project")} with saved analyses`}
                </dd>
              </div>
              <div className="card p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Contracts</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {summary.contractCount}
                </dd>
                <dd className="mt-1 text-xs text-subtle">Across all projects</dd>
              </div>
              <div className="card p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
                  Saved analyses
                </dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {summary.analysisCount}
                </dd>
                <dd className="mt-1 text-xs text-subtle">{analysesCaption}</dd>
              </div>
              <div className="card p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
                  Latest review
                </dt>
                <dd
                  className="mt-1 text-xl font-semibold text-foreground"
                  title={summary.latestAnalysisAt ? formatDateTime(summary.latestAnalysisAt) : undefined}
                >
                  {summary.latestAnalysisAt ? formatRelativeTime(summary.latestAnalysisAt) : "—"}
                </dd>
                <dd className="mt-1 text-xs text-subtle">
                  {summary.latestAnalysisAt ? "Saved comparison" : "No analyses yet"}
                </dd>
              </div>
            </dl>

            <div className="grid gap-6 xl:grid-cols-[1fr_19rem]">
              <section aria-labelledby="projects-heading">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="projects-heading" className="text-lg font-semibold tracking-tight">
                    Projects
                  </h2>
                  {summary.capped ? (
                    <span className="text-xs text-subtle">
                      Inspected {summary.projects.length} of {summary.projectCount}
                    </span>
                  ) : null}
                </div>

                {hasProjects ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {projects.map(({ project, history }) => {
                      const latest = history?.latestAnalysis ?? null;
                      return (
                        <article key={project.id} className="card flex flex-col p-5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3
                                className="truncate text-sm font-semibold text-foreground"
                                title={project.name}
                              >
                                {project.name}
                              </h3>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-subtle">
                                {project.description ?? "No description."}
                              </p>
                            </div>
                            <Badge tone="outline" className="shrink-0">
                              {pluralize(project.contractCount, "contract")}
                            </Badge>
                          </div>

                          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <dt className="text-subtle">Saved analyses</dt>
                              <dd className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
                                {history ? history.analysisCount : "Unavailable"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-subtle">Latest review</dt>
                              <dd
                                className="mt-0.5 text-sm font-medium text-foreground"
                                title={latest ? formatDateTime(latest.createdAt) : undefined}
                              >
                                {latest ? formatRelativeTime(latest.createdAt) : "None yet"}
                              </dd>
                            </div>
                          </dl>

                          <div className="mt-4 border-t border-line pt-3">
                            {history === null ? (
                              <p className="text-xs text-warning">
                                History could not be loaded for this project.
                              </p>
                            ) : latest ? (
                              <AnalysisSummary analysis={latest} />
                            ) : (
                              <p className="text-xs text-subtle">
                                No comparison saved for this project yet.
                              </p>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    title="No projects yet"
                    description="Create a project in the contract workspace, upload a baseline and candidate OpenAPI document, then run your first comparison."
                    action={
                      <Link href="/contracts" className="btn-primary">
                        Create your first project
                      </Link>
                    }
                  />
                )}
              </section>

              <aside className="grid gap-4 sm:grid-cols-2 xl:block xl:space-y-4">
                <div className="card p-5">
                  <h2 className="text-sm font-semibold text-foreground">Risk levels</h2>
                  <p className="mt-1 text-xs leading-5 text-subtle">
                    Every finding carries one of these classifications.
                  </p>
                  <ul className="mt-4 space-y-3">
                    {RISK_ORDER.map((risk) => (
                      <li key={risk}>
                        <Badge tone={RISK_TONE[risk]} withDot>
                          {RISK_LABELS[risk]}
                        </Badge>
                        <p className="mt-1 text-xs leading-5 text-muted">{RISK_DESCRIPTIONS[risk]}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="card-muted p-5">
                  <h2 className="text-sm font-semibold text-foreground">How counts work</h2>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Project and contract counts are exact. Saved-analysis totals are read from each
                    project&apos;s history and cover up to {DASHBOARD_PROJECT_LIMIT} projects per
                    dashboard load.
                  </p>
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function DashboardView() {
  return (
    <AuthGate
      signInTitle="Sign in to open your dashboard"
      signInDescription={
        <p>
          Your dashboard summarizes projects, contract counts, and saved analyses that belong to
          your account only.
        </p>
      }
    >
      <DashboardBody />
    </AuthGate>
  );
}
