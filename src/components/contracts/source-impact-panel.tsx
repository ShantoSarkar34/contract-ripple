"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AnalysisRunDetailDto,
  SourceImpactDto,
  SourceSnapshotDetailDto,
  SourceSnapshotDto,
} from "@contract-ripple/shared";
import { ApiRequestError, api, describeErrorDetails } from "@/lib/api";
import { CONFIDENCE_CLASSES, CONFIDENCE_LABELS, displayPath, methodClass } from "@/lib/findings";
import { formatBytes } from "@/lib/format";
import ImpactGraph from "./impact-graph";

/** Local mirror of the server limit; keep the shared package out of the client bundle. */
const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;

type LoadState = "idle" | "loading" | "ready" | "error";
type PanelError = { message: string; details: string[] };

function toPanelError(error: unknown): PanelError {
  if (error instanceof ApiRequestError) {
    return { message: error.message, details: describeErrorDetails(error) };
  }
  return {
    message: error instanceof Error ? error.message : "An unexpected error occurred.",
    details: [],
  };
}

function toSnapshotSummary(detail: SourceSnapshotDetailDto): SourceSnapshotDto {
  return {
    id: detail.id,
    projectId: detail.projectId,
    analysisRunId: detail.analysisRunId,
    sourceType: detail.sourceType,
    repository: detail.repository,
    ref: detail.ref,
    fileCount: detail.fileCount,
    skippedCount: detail.skippedCount,
    totalBytes: detail.totalBytes,
    impactCount: detail.impactCount,
    limitations: detail.limitations,
    createdAt: detail.createdAt,
  };
}

function sourceLabel(snapshot: SourceSnapshotDto): string {
  if (snapshot.sourceType === "github") {
    return `${snapshot.repository ?? "GitHub repository"}${snapshot.ref ? ` @ ${snapshot.ref}` : ""}`;
  }
  return "ZIP upload";
}

function ImpactRow({ impact }: { impact: SourceImpactDto }) {
  return (
    <li className="rounded-md border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-bold uppercase ${methodClass(impact.matchedMethod)}`}
        >
          {impact.matchedMethod}
        </span>
        <span className="break-all font-mono text-sm font-semibold text-foreground">
          {impact.matchedPath}
        </span>
        <span className="break-all text-xs text-subtle">
          call path <span className="font-mono">{impact.path}</span>
        </span>
        <span
          className={`ml-auto text-xs font-semibold ${CONFIDENCE_CLASSES[impact.confidence]}`}
        >
          {CONFIDENCE_LABELS[impact.confidence]} confidence
        </span>
      </div>

      <p className="mt-2 text-xs text-subtle">
        {impact.operationId ? (
          <>
            operation <span className="font-mono">{impact.operationId}</span> ·{" "}
          </>
        ) : null}
        line {impact.line}, column {impact.column}
      </p>
      <pre
        tabIndex={0}
        aria-label="Source evidence snippet"
        className="mt-2 overflow-x-auto rounded bg-surface-muted p-2 font-mono text-xs text-foreground"
      >
        {impact.snippet}
      </pre>
      <p className="mt-2 text-xs text-subtle">{impact.evidence}</p>
    </li>
  );
}

export default function SourceImpactPanel({
  projectId,
  analysis,
}: {
  projectId: string;
  analysis: AnalysisRunDetailDto;
}) {
  const [githubConfigured, setGithubConfigured] = useState<boolean | null>(null);
  const [snapshots, setSnapshots] = useState<SourceSnapshotDto[]>([]);
  const [snapshotsState, setSnapshotsState] = useState<LoadState>("loading");
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [active, setActive] = useState<SourceSnapshotDetailDto | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [repository, setRepository] = useState("");
  const [ref, setRef] = useState("");
  const [submitting, setSubmitting] = useState<"zip" | "github" | null>(null);
  const [error, setError] = useState<PanelError | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [status, snapshotResponse] = await Promise.all([
          api.getGitHubStatus(),
          api.listSourceSnapshots(projectId),
        ]);
        if (cancelled) {
          return;
        }
        setGithubConfigured(status.configured);
        const matchingSnapshots = snapshotResponse.snapshots.filter(
          (snapshot) => snapshot.analysisRunId === analysis.id,
        );
        setSnapshots(matchingSnapshots);
        setSnapshotsState("ready");

        const latest = matchingSnapshots[0];
        if (latest) {
          try {
            const detail = await api.getSourceSnapshot(latest.id);
            if (!cancelled) {
              setActive(detail);
            }
          } catch (detailError) {
            if (!cancelled) {
              setError(toPanelError(detailError));
            }
          }
        } else {
          setActive(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setSnapshotsState("error");
          setLoadFailed(true);
          setError(toPanelError(loadError));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, analysis.id, reloadKey]);

  function applySnapshot(detail: SourceSnapshotDetailDto): void {
    setActive(detail);
    setSnapshots((current) => [
      toSnapshotSummary(detail),
      ...current.filter((snapshot) => snapshot.id !== detail.id),
    ]);
  }

  async function handleZipSubmit(): Promise<void> {
    if (!zipFile) {
      setError({ message: "Choose a ZIP archive first.", details: [] });
      return;
    }
    if (zipFile.size > MAX_ARCHIVE_BYTES) {
      setError({ message: "That archive exceeds the 10 MiB limit.", details: [] });
      return;
    }

    setSubmitting("zip");
    setError(null);
    setLoadFailed(false);
    try {
      const detail = await api.analyzeZipSource(projectId, zipFile, {
        analysisRunId: analysis.id,
      });
      applySnapshot(detail);
      setZipFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (submitError) {
      setError(toPanelError(submitError));
    } finally {
      setSubmitting(null);
    }
  }

  async function handleGithubSubmit(): Promise<void> {
    if (!repository.trim()) {
      setError({ message: "Enter a GitHub repository as owner/name.", details: [] });
      return;
    }

    setSubmitting("github");
    setError(null);
    setLoadFailed(false);
    try {
      const detail = await api.analyzeGithubSource(projectId, {
        repository: repository.trim(),
        ref: ref.trim() || undefined,
        analysisRunId: analysis.id,
      });
      applySnapshot(detail);
    } catch (submitError) {
      setError(toPanelError(submitError));
    } finally {
      setSubmitting(null);
    }
  }

  async function handleLoadSnapshot(snapshotId: string): Promise<void> {
    setLoadingSnapshot(true);
    setError(null);
    try {
      const detail = await api.getSourceSnapshot(snapshotId);
      setActive(detail);
    } catch (loadError) {
      setError(toPanelError(loadError));
    } finally {
      setLoadingSnapshot(false);
    }
  }

  function retrySnapshots(): void {
    setSnapshotsState("loading");
    setError(null);
    setLoadFailed(false);
    setReloadKey((current) => current + 1);
  }

  const groupedImpacts = new Map<string, SourceImpactDto[]>();
  for (const impact of active?.impacts ?? []) {
    const existing = groupedImpacts.get(impact.filePath) ?? [];
    existing.push(impact);
    groupedImpacts.set(impact.filePath, existing);
  }

  return (
    <section id="impact-map" className="card scroll-mt-24 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-subtle">
            4 · Source impact
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Upload a ZIP of your frontend or analyze a GitHub repository to find calls that match
            the changed operations in this comparison. Every result includes file, line, and source
            evidence.
          </p>
        </div>
        <p className="text-xs text-subtle">Evidence-backed static analysis</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-line p-3">
          <h3 className="text-sm font-semibold text-foreground">ZIP archive</h3>
          <p className="mt-1 text-xs text-subtle">
            TypeScript and JavaScript only. Maximum 10 MiB. Files are analyzed in memory and never
            executed.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="mt-3 block min-h-11 w-full text-sm text-muted file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-secondary-light file:px-3 file:py-2 file:text-sm file:font-medium file:text-foreground"
            aria-label="Source ZIP archive"
            onChange={(event) => setZipFile(event.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="btn-secondary mt-3 w-full"
            disabled={submitting !== null || !zipFile}
            onClick={() => void handleZipSubmit()}
          >
            {submitting === "zip" ? "Analyzing…" : "Analyze ZIP"}
          </button>
        </div>

        <div className="rounded-md border border-line p-3">
          <h3 className="text-sm font-semibold text-foreground">GitHub repository</h3>
          <p className="mt-1 text-xs text-subtle">
            Read-only analysis through the official GitHub API. The server token is never sent to
            the browser.
          </p>
          <input
            className="input mt-3"
            placeholder="owner/repository"
            value={repository}
            onChange={(event) => setRepository(event.target.value)}
            aria-label="GitHub repository"
          />
          <input
            className="input mt-2"
            placeholder="Branch, tag, or commit (optional)"
            value={ref}
            onChange={(event) => setRef(event.target.value)}
            aria-label="GitHub ref"
          />
          {githubConfigured === false ? (
            <p className="mt-2 text-xs text-warning">
              GitHub is not configured on the API server. Set <code>GITHUB_TOKEN</code> to enable
              repository analysis.
            </p>
          ) : null}
          {githubConfigured === null ? (
            <p className="mt-2 text-xs text-subtle">
              {snapshotsState === "error"
                ? "GitHub configuration status could not be loaded."
                : "Checking GitHub configuration…"}
            </p>
          ) : null}
          <button
            type="button"
            className="btn-secondary mt-3 w-full"
            disabled={
              submitting !== null || githubConfigured !== true || !repository.trim()
            }
            onClick={() => void handleGithubSubmit()}
          >
            {submitting === "github" ? "Analyzing…" : "Analyze GitHub"}
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-md border border-danger/30 bg-danger-light p-3 text-sm text-danger"
        >
          <p className="font-medium">{error.message}</p>
          {error.details.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {error.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
          {loadFailed ? (
            <button
              type="button"
              className="mt-2 text-xs font-semibold underline"
              onClick={retrySnapshots}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5">
        {snapshotsState === "loading" ? (
          <p className="text-sm text-subtle">
            Loading previous source analyses…
          </p>
        ) : null}

        {snapshotsState === "ready" && snapshots.length === 0 ? (
          <div className="rounded-md border border-dashed border-line-strong p-4 text-sm text-subtle">
            No source analysis has been run for this comparison yet. Analyze a ZIP archive or a
            GitHub repository to look for affected integrations.
          </div>
        ) : null}

        {snapshotsState === "ready" && snapshots.length > 0 && !active ? (
          <p className="text-sm text-subtle">
            Select a source analysis below to review its evidence.
          </p>
        ) : null}

        {active ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-semibold text-foreground">
                {sourceLabel(active)}
                <span className="ml-2 text-sm font-normal text-subtle">
                  {new Date(active.createdAt).toLocaleString()}
                </span>
              </h3>
              <p className="text-xs text-subtle">
                {active.fileCount} file(s) scanned · {active.skippedCount} skipped ·{" "}
                {formatBytes(active.totalBytes)}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-surface-muted p-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
                  Affected calls
                </dt>
                <dd className="mt-1 text-2xl font-bold text-primary">{active.impactCount}</dd>
              </div>
              <div className="rounded-md bg-surface-muted p-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
                  Files with matches
                </dt>
                <dd className="mt-1 text-2xl font-bold text-foreground">{groupedImpacts.size}</dd>
              </div>
              <div className="rounded-md bg-surface-muted p-3">
                <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
                  Source type
                </dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {active.sourceType === "github" ? "GitHub" : "ZIP upload"}
                </dd>
              </div>
            </dl>

            <ImpactGraph analysis={analysis} snapshot={active} />

            {active.impacts.length === 0 ? (
              <p className="rounded-md border border-warning/30 bg-warning-light p-3 text-sm text-warning">
                No affected API calls were found in the scanned files. The static analyzer only
                matches calls whose HTTP method and path are statically resolvable; dynamic URLs,
                custom wrappers, and generated clients may still be affected.
              </p>
            ) : (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-foreground">Evidence by file</h4>
                <ul className="space-y-4">
                  {[...groupedImpacts.entries()].map(([filePath, impacts]) => (
                    <li key={filePath}>
                      <p className="mb-2 break-all font-mono text-sm font-semibold text-foreground">
                        {displayPath(filePath)}
                      </p>
                      <ul className="space-y-2">
                        {impacts.map((impact) => (
                          <ImpactRow key={impact.id} impact={impact} />
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {active.limitations.length > 0 ? (
              <details className="rounded-md border border-line p-3 text-sm">
                <summary className="min-h-11 cursor-pointer py-2 font-medium text-foreground">
                  Analysis limitations
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                  {active.limitations.map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}

        {snapshots.length > 0 ? (
          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-subtle">
              Source analysis history for this comparison
            </h3>
            <ul className="mt-2 space-y-1">
              {snapshots.slice(0, 5).map((snapshot) => (
                <li key={snapshot.id}>
                  <button
                    type="button"
                    className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-strong ${
                    active?.id === snapshot.id ? "bg-surface-strong" : ""
                  }`}
                    disabled={loadingSnapshot}
                    onClick={() => void handleLoadSnapshot(snapshot.id)}
                  >
                    <span className="font-medium text-foreground">{sourceLabel(snapshot)}</span>
                    <span className="mt-0.5 block text-xs text-subtle">
                      {snapshot.impactCount} affected call(s) ·{" "}
                      {new Date(snapshot.createdAt).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
