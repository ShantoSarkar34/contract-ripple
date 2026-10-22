"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AnalysisRunDetailDto, ProjectDto } from "@contract-ripple/shared";
import ComparisonResults from "@/components/contracts/comparison-results";
import RegressionSuggestions from "@/components/contracts/regression-suggestions";
import SourceImpactPanel from "@/components/contracts/source-impact-panel";
import { AuthGate } from "@/components/workspace/auth-gate";
import { Breadcrumbs, LoadFailure } from "@/components/workspace/breadcrumbs";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { analysisRange, analysisTitle, formatDuration } from "@/lib/analysis";
import { api } from "@/lib/api";
import { describeRequestFailure } from "@/lib/errors";
import { formatDateTime, pluralize } from "@/lib/format";

type LoadState = "loading" | "ready" | "error";

function AnalysisSidebar({
  analysis,
  project,
}: {
  analysis: AnalysisRunDetailDto;
  project: ProjectDto | null;
}) {
  const statusTone = analysis.status === "failed" ? "danger" : "success";
  const statusLabel = analysis.status === "failed" ? "Failed" : "Completed";

  return (
    <aside className="space-y-4">
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-foreground">Run details</h2>
        <dl className="mt-3 space-y-3 text-xs">
          <div>
            <dt className="text-subtle">Status</dt>
            <dd className="mt-1">
              <Badge tone={statusTone} withDot>
                {statusLabel}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-subtle">Project</dt>
            <dd className="mt-1">
              {project ? (
                <Link href={`/projects/${project.id}`} className="link">
                  {project.name}
                </Link>
              ) : (
                <span className="text-muted">Unavailable</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-subtle">Completed</dt>
            <dd className="mt-0.5 text-foreground">{formatDateTime(analysis.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-subtle">Duration</dt>
            <dd className="mt-0.5 tabular-nums text-foreground">
              {formatDuration(analysis.durationMs)}
            </dd>
          </div>
          <div>
            <dt className="text-subtle">Findings</dt>
            <dd className="mt-0.5 tabular-nums text-foreground">
              {pluralize(analysis.totalFindings, "finding")}
            </dd>
          </div>
          <div>
            <dt className="text-subtle">Limitations</dt>
            <dd className="mt-0.5 text-foreground">
              {analysis.limitations.length === 0
                ? "None recorded"
                : pluralize(analysis.limitations.length, "limitation")}
            </dd>
          </div>
        </dl>
      </div>

      <div className="card-muted p-5">
        <h2 className="text-sm font-semibold text-foreground">Versions</h2>
        <div className="mt-3 space-y-4 text-xs">
          <div>
            <p className="font-semibold text-foreground">Baseline</p>
            <p className="mt-1 text-muted">
              {analysis.baseline.contractName} ·{" "}
              {analysis.baseline.versionLabel ?? analysis.baseline.versionId}
            </p>
            <p className="mt-0.5 text-subtle">OpenAPI {analysis.baseline.openapi}</p>
            {analysis.baseline.warnings.length > 0 ? (
              <p className="mt-1 text-warning">
                {pluralize(analysis.baseline.warnings.length, "parser warning")}
              </p>
            ) : null}
          </div>
          <div className="border-t border-line pt-4">
            <p className="font-semibold text-foreground">Candidate</p>
            <p className="mt-1 text-muted">
              {analysis.candidate.contractName} ·{" "}
              {analysis.candidate.versionLabel ?? analysis.candidate.versionId}
            </p>
            <p className="mt-0.5 text-subtle">OpenAPI {analysis.candidate.openapi}</p>
            {analysis.candidate.warnings.length > 0 ? (
              <p className="mt-1 text-warning">
                {pluralize(analysis.candidate.warnings.length, "parser warning")}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-foreground">Source evidence</h2>
        <p className="mt-2 text-xs leading-5 text-muted">
          Impact relationships are derived only from the source snapshot attached to this run.
          Dynamic URLs and custom API wrappers may not be detected.
        </p>
        <Link
          href={`/contracts?project=${encodeURIComponent(analysis.projectId)}`}
          className="btn-secondary mt-4 w-full"
        >
          Open project workspace
        </Link>
      </div>

      <div className="card-muted p-5">
        <h2 className="text-sm font-semibold text-foreground">Analysis ID</h2>
        <p className="mt-2 break-all font-mono text-[11px] text-muted">{analysis.id}</p>
      </div>
    </aside>
  );
}

function AnalysisDetailBody({ analysisId }: { analysisId: string }) {
  const [state, setState] = useState<LoadState>("loading");
  const [analysis, setAnalysis] = useState<AnalysisRunDetailDto | null>(null);
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [failure, setFailure] = useState<ReturnType<typeof describeRequestFailure> | null>(null);
  const [projectUnavailable, setProjectUnavailable] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const run = await api.getComparison(analysisId);
        if (!active) {
          return;
        }
        setAnalysis(run);
        setState("ready");

        try {
          const loadedProject = await api.getProject(run.projectId);
          if (active) {
            setProject(loadedProject);
          }
        } catch {
          if (active) {
            setProjectUnavailable(true);
          }
        }
      } catch (loadError) {
        if (!active) {
          return;
        }
        setFailure(describeRequestFailure(loadError, "Could not load this analysis."));
        setState("error");
      }
    })();

    return () => {
      active = false;
    };
  }, [analysisId, reloadKey]);

  function retry() {
    setState("loading");
    setFailure(null);
    setProject(null);
    setProjectUnavailable(false);
    setAnalysis(null);
    setReloadKey((current) => current + 1);
  }

  if (state === "loading") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Projects", href: "/projects" }, { label: "Analysis" }]} />
        <PageHeader eyebrow="Saved analysis" title="Loading analysis…" />
        <p className="sr-only" role="status" aria-live="polite">
          Loading this saved analysis…
        </p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2" aria-hidden="true">
          <div className="card h-40 p-5">
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton mt-4 h-24 w-full" />
          </div>
          <div className="card h-40 p-5">
            <div className="skeleton h-4 w-1/3" />
            <div className="skeleton mt-4 h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (state === "error" || !analysis) {
    const notFound = failure?.notFound ?? false;
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
        <Breadcrumbs items={[{ label: "Projects", href: "/projects" }, { label: "Analysis" }]} />
        {notFound ? (
          <EmptyState
            title="Analysis not found"
            description="This saved analysis does not exist, or it belongs to a different account."
            action={
              <Link href="/history" className="btn-primary">
                Browse history
              </Link>
            }
          />
        ) : (
          <LoadFailure
            title="Could not load this analysis"
            message={failure?.message ?? "The API did not respond as expected."}
            details={failure?.details}
            onRetry={retry}
          />
        )}
      </div>
    );
  }

  const projectCrumb = project
    ? { label: project.name, href: `/projects/${project.id}` }
    : { label: "Project", href: `/projects/${analysis.projectId}` };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "Projects", href: "/projects" },
          projectCrumb,
          { label: "Analysis" },
        ]}
      />

      <PageHeader
        eyebrow="Saved analysis"
        title={analysisTitle(analysis)}
        description={
          <>
            {project ? (
              <Link href={`/projects/${project.id}`} className="link">
                {project.name}
              </Link>
            ) : (
              "Project"
            )}{" "}
            · {analysisRange(analysis)}. This is a persisted comparison snapshot with its
            findings, source impact, report, and regression checks.
          </>
        }
        actions={
          <>
            {project ? (
              <Link href={`/projects/${project.id}`} className="btn-secondary whitespace-nowrap">
                Back to project
              </Link>
            ) : (
              <Link href="/projects" className="btn-secondary whitespace-nowrap">
                Projects
              </Link>
            )}
            <Link
              href={`/contracts?project=${encodeURIComponent(analysis.projectId)}`}
              className="btn-primary whitespace-nowrap"
            >
              Open workspace
            </Link>
          </>
        }
        meta={
          <>
            <Badge tone={analysis.status === "failed" ? "danger" : "success"} withDot>
              {analysis.status === "failed" ? "Failed" : "Completed"}
            </Badge>
            <span>{formatDateTime(analysis.createdAt)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDuration(analysis.durationMs)}</span>
            <span aria-hidden="true">·</span>
            <span>{pluralize(analysis.totalFindings, "finding")}</span>
            {analysis.truncated ? <Badge tone="warning">Truncated</Badge> : null}
          </>
        }
      />

      {analysis.status === "failed" ? (
        <Alert tone="danger" title="This analysis did not complete" className="mt-6">
          The comparison failed, so the findings below may be empty or incomplete. Run a new
          comparison from the workspace after checking the contract versions.
        </Alert>
      ) : null}

      {projectUnavailable ? (
        <Alert tone="info" title="Project details unavailable" className="mt-6">
          The analysis loaded, but its project record could not be read. The run and its evidence
          are still shown below.
        </Alert>
      ) : null}

      <nav
        aria-label="Analysis sections"
        className="sticky top-16 z-10 mt-6 flex flex-wrap gap-1 rounded-xl border border-line bg-surface/95 p-1.5 shadow-card backdrop-blur"
      >
        <a
          href="#comparison-report"
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-strong hover:text-foreground"
        >
          Findings
        </a>
        <a
          href="#impact-map"
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-strong hover:text-foreground"
        >
          Source impact
        </a>
        <a
          href="#regression-suggestions"
          className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-strong hover:text-foreground"
        >
          Regression checks
        </a>
      </nav>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-6">
          <ComparisonResults analysis={analysis} />
          <SourceImpactPanel
            key={analysis.id}
            projectId={analysis.projectId}
            analysis={analysis}
          />
          <RegressionSuggestions analysis={analysis} />
        </div>

        <AnalysisSidebar analysis={analysis} project={project} />
      </div>
    </div>
  );
}

export default function AnalysisDetail({ analysisId }: { analysisId: string }) {
  return (
    <AuthGate
      signInTitle="Sign in to view this analysis"
      signInDescription={
        <p>
          Saved comparisons, findings, and source evidence are private to the account that
          created them.
        </p>
      }
    >
      <AnalysisDetailBody analysisId={analysisId} />
    </AuthGate>
  );
}
