"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AnalysisRunDto, ProjectDto } from "@contract-ripple/shared";
import { AuthGate } from "@/components/workspace/auth-gate";
import { AnalysisRow } from "@/components/workspace/analysis-row";
import { Breadcrumbs, LoadFailure } from "@/components/workspace/breadcrumbs";
import { Alert } from "@/components/ui/alert";
import { EmptyState, SkeletonCard } from "@/components/ui/feedback";
import { Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { describeRequestFailure } from "@/lib/errors";
import { pluralize } from "@/lib/format";
import {
  HISTORY_MAX_ENTRIES,
  HISTORY_PAGE_SIZE,
  HISTORY_PER_PROJECT,
  HISTORY_PROJECT_LIMIT,
  mergeRecentAnalyses,
  type ProjectAnalysisEntry,
} from "@/lib/history";

type LoadState = "loading" | "ready" | "error";

type AllHistory = {
  entries: ProjectAnalysisEntry[];
  failures: number;
  inspected: number;
  capped: boolean;
};

function HistorySkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

function HistoryBody({ initialProjectId }: { initialProjectId: string }) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [projectsState, setProjectsState] = useState<LoadState>("loading");
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [selection, setSelection] = useState<string>(initialProjectId || "all");
  const [reloadKey, setReloadKey] = useState(0);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const [allState, setAllState] = useState<LoadState>("loading");
  const [allHistory, setAllHistory] = useState<AllHistory | null>(null);
  const [allError, setAllError] = useState<string | null>(null);

  const [projectState, setProjectState] = useState<LoadState>("loading");
  const [projectAnalyses, setProjectAnalyses] = useState<AnalysisRunDto[]>([]);
  const [projectTotal, setProjectTotal] = useState(0);
  const [projectNextCursor, setProjectNextCursor] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const selectionRef = useRef<string>("all");
  const selectionIsKnown =
    selection === "all" || projects.some((project) => project.id === selection);
  const effectiveSelection = selectionIsKnown ? selection : "all";

  useEffect(() => {
    let active = true;

    api
      .listProjects()
      .then((response) => {
        if (!active) {
          return;
        }
        setProjects(response.projects);
        setProjectsState("ready");
        setProjectsError(null);
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }
        setProjectsError(
          describeRequestFailure(loadError, "Could not load your projects.").message,
        );
        setProjectsState("error");
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => {
    selectionRef.current = effectiveSelection;
  }, [effectiveSelection]);

  useEffect(() => {
    if (projectsState !== "ready") {
      return;
    }
    let active = true;

    if (effectiveSelection === "all") {
      const inspected = projects.slice(0, HISTORY_PROJECT_LIMIT);

      void Promise.allSettled(
        inspected.map((project) =>
          api.listComparisons(project.id, { limit: HISTORY_PER_PROJECT }),
        ),
      ).then((results) => {
        if (!active) {
          return;
        }

        const entries: ProjectAnalysisEntry[] = [];
        let failures = 0;
        results.forEach((result, index) => {
          const project = inspected[index];
          if (!project) {
            return;
          }
          if (result.status === "fulfilled") {
            for (const analysis of result.value.analyses) {
              entries.push({ project, analysis });
            }
          } else {
            failures += 1;
          }
        });

        if (inspected.length > 0 && failures === inspected.length) {
          const firstFailure = results.find(
            (result): result is PromiseRejectedResult => result.status === "rejected",
          );
          setAllError(
            describeRequestFailure(
              firstFailure?.reason,
              "Could not load any project history.",
            ).message,
          );
          setAllState("error");
          return;
        }

        setAllHistory({
          entries: mergeRecentAnalyses(entries),
          failures,
          inspected: inspected.length,
          capped: projects.length > inspected.length,
        });
        setAllState("ready");
      });
    } else {
      api
        .listComparisons(effectiveSelection, { limit: HISTORY_PAGE_SIZE })
        .then((response) => {
          if (!active || selectionRef.current !== effectiveSelection) {
            return;
          }
          setProjectAnalyses(response.analyses);
          setProjectTotal(response.totalCount);
          setProjectNextCursor(response.nextCursor);
          setProjectState("ready");
        })
        .catch((loadError: unknown) => {
          if (!active || selectionRef.current !== effectiveSelection) {
            return;
          }
          setProjectError(
            describeRequestFailure(loadError, "Could not load this project's history.").message,
          );
          setProjectState("error");
        });
    }

    return () => {
      active = false;
    };
  }, [effectiveSelection, projects, projectsState, reloadKey]);

  function retry() {
    setProjectsState("loading");
    setProjectsError(null);
    setAllState("loading");
    setAllError(null);
    setProjectState("loading");
    setProjectError(null);
    setReloadKey((value) => value + 1);
  }

  function handleSelectionChange(value: string) {
    setSelection(value);
    setLoadMoreError(null);
    if (value === "all") {
      setAllState("loading");
      setAllError(null);
    } else {
      setProjectState("loading");
      setProjectError(null);
      setProjectAnalyses([]);
      setProjectTotal(0);
      setProjectNextCursor(null);
    }
    router.replace(
      value === "all" ? "/history" : `/history?project=${encodeURIComponent(value)}`,
      { scroll: false },
    );
  }

  async function handleLoadMore(): Promise<void> {
    if (!projectNextCursor || effectiveSelection === "all" || loadingMore) {
      return;
    }
    const requestedSelection = effectiveSelection;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const response = await api.listComparisons(requestedSelection, {
        limit: HISTORY_PAGE_SIZE,
        cursor: projectNextCursor,
      });
      if (selectionRef.current !== requestedSelection) {
        return;
      }
      setProjectAnalyses((current) => [...current, ...response.analyses]);
      setProjectTotal(response.totalCount);
      setProjectNextCursor(response.nextCursor);
    } catch (loadError) {
      if (selectionRef.current !== requestedSelection) {
        return;
      }
      setLoadMoreError(
        describeRequestFailure(loadError, "Could not load more history.").message,
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const selectedProject =
    effectiveSelection !== "all"
      ? (projects.find((project) => project.id === effectiveSelection) ?? null)
      : null;
  const shownCount =
    effectiveSelection === "all" ? (allHistory?.entries.length ?? 0) : projectAnalyses.length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: "Workspace", href: "/dashboard" }, { label: "History" }]} />

      <PageHeader
        eyebrow="Workspace"
        title="History"
        description="Every saved comparison, with its risk counts and a link to the full findings, source impact, report, and regression checks."
        actions={
          <>
            <Link href="/projects" className="btn-secondary whitespace-nowrap">
              Projects
            </Link>
            <Link
              href={
                selectedProject
                  ? `/contracts?project=${encodeURIComponent(selectedProject.id)}`
                  : "/contracts"
              }
              className="btn-primary whitespace-nowrap"
            >
              Open workspace
            </Link>
          </>
        }
        meta={
          projectsState === "ready" ? (
            <>
              <span>{pluralize(projects.length, "project")}</span>
              <span aria-hidden="true">·</span>
              <span>
                {effectiveSelection === "all"
                  ? `${shownCount} recent analyses shown`
                  : `${shownCount} of ${projectTotal} analyses`}
              </span>
            </>
          ) : undefined
        }
      />

      <div className="mt-6 space-y-4">
        {projectsState === "error" ? (
          <LoadFailure
            title="Could not load your projects"
            message={projectsError ?? "The API did not respond as expected."}
            onRetry={retry}
          />
        ) : null}

        {projectsState === "loading" ? (
          <>
            <p className="sr-only" role="status" aria-live="polite">
              Loading your history…
            </p>
            <HistorySkeleton />
          </>
        ) : null}

        {projectsState === "ready" ? (
          <>
            <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="w-full sm:max-w-sm">
                <label
                  htmlFor="history-project"
                  className="block text-sm font-medium text-foreground"
                >
                  Project
                </label>
                <Select
                  id="history-project"
                  className="mt-1.5"
                  value={effectiveSelection}
                  onChange={(event) => handleSelectionChange(event.target.value)}
                >
                  <option value="all">All projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </div>
              <p className="text-xs leading-5 text-subtle sm:max-w-sm sm:text-right">
                {effectiveSelection === "all"
                  ? `The latest ${HISTORY_PER_PROJECT} analyses per project, newest first.`
                  : "The selected project's complete saved history, newest first."}
              </p>
            </div>

            {projects.length === 0 ? (
              <EmptyState
                title="No projects yet"
                description="Create a project in the workspace and save a comparison to start your history."
                action={
                  <Link href="/projects" className="btn-primary">
                    Go to projects
                  </Link>
                }
              />
            ) : effectiveSelection === "all" ? (
              <>
                {allState === "loading" ? (
                  <>
                    <p className="sr-only" role="status" aria-live="polite">
                      Loading recent analyses…
                    </p>
                    <HistorySkeleton />
                  </>
                ) : null}

                {allState === "error" ? (
                  <LoadFailure
                    title="Could not load recent analyses"
                    message={allError ?? "The API did not respond as expected."}
                    onRetry={retry}
                  />
                ) : null}

                {allState === "ready" && allHistory ? (
                  <>
                    {allHistory.failures > 0 || allHistory.capped ? (
                      <Alert tone="info" title="Partial history">
                        {allHistory.capped
                          ? `Only the first ${allHistory.inspected} projects were inspected. `
                          : ""}
                        {allHistory.failures > 0
                          ? `${pluralize(allHistory.failures, "project history", "project histories")} could not be loaded and are not shown. `
                          : ""}
                        Select a project to paginate its full history.
                      </Alert>
                    ) : null}

                    {allHistory.entries.length === 0 ? (
                      <EmptyState
                        title="No saved analyses yet"
                        description="Upload two contract versions and run a comparison in the review workspace. Saved runs will appear here."
                        action={
                          <Link href="/contracts" className="btn-primary">
                            Open review workspace
                          </Link>
                        }
                      />
                    ) : (
                      <>
                        <ul className="space-y-3">
                          {allHistory.entries.map(({ project, analysis }) => (
                            <AnalysisRow
                              key={`${project.id}:${analysis.id}`}
                              analysis={analysis}
                              projectName={project.name}
                              href={`/analyses/${analysis.id}`}
                            />
                          ))}
                        </ul>
                        <p className="text-xs text-subtle">
                          Showing {allHistory.entries.length} of up to {HISTORY_MAX_ENTRIES}{" "}
                          merged entries. Select a project above for its complete history.
                        </p>
                      </>
                    )}
                  </>
                ) : null}
              </>
            ) : (
              <>
                {projectState === "loading" ? (
                  <>
                    <p className="sr-only" role="status" aria-live="polite">
                      Loading project history…
                    </p>
                    <HistorySkeleton />
                  </>
                ) : null}

                {projectState === "error" ? (
                  <LoadFailure
                    title="Could not load this project's history"
                    message={projectError ?? "The API did not respond as expected."}
                    onRetry={retry}
                  />
                ) : null}

                {projectState === "ready" ? (
                  projectAnalyses.length === 0 ? (
                    <EmptyState
                      title="No saved analyses in this project"
                      description="Run a comparison in the review workspace. Every saved run appears in the history with its evidence."
                      action={
                        <>
                          <Link
                            href={`/contracts?project=${encodeURIComponent(effectiveSelection)}`}
                            className="btn-primary"
                          >
                            Open review workspace
                          </Link>
                          {selectedProject ? (
                            <Link
                              href={`/projects/${selectedProject.id}`}
                              className="btn-secondary"
                            >
                              View project
                            </Link>
                          ) : null}
                        </>
                      }
                    />
                  ) : (
                    <>
                      <ul className="space-y-3">
                        {projectAnalyses.map((analysis) => (
                          <AnalysisRow
                            key={analysis.id}
                            analysis={analysis}
                            href={`/analyses/${analysis.id}`}
                          />
                        ))}
                      </ul>

                      {loadMoreError ? (
                        <Alert tone="warning" title="Could not load more analyses">
                          {loadMoreError}
                        </Alert>
                      ) : null}

                      {projectNextCursor ? (
                        <div className="flex justify-center">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => void handleLoadMore()}
                            disabled={loadingMore}
                          >
                            {loadingMore ? "Loading…" : "Load more analyses"}
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-subtle">
                          Showing all {projectTotal} saved analyses in this project.
                        </p>
                      )}
                    </>
                  )
                ) : null}
              </>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

export default function HistoryView({ initialProjectId }: { initialProjectId: string }) {
  return (
    <AuthGate
      signInTitle="Sign in to view your history"
      signInDescription={
        <p>Saved analyses are private to the account that created them.</p>
      }
    >
      <HistoryBody initialProjectId={initialProjectId} />
    </AuthGate>
  );
}
