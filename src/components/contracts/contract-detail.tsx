"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  AnalysisRunDto,
  ContractDetailDto,
  ProjectDto,
} from "@contract-ripple/shared";
import { AuthGate } from "@/components/workspace/auth-gate";
import { AnalysisRow } from "@/components/workspace/analysis-row";
import { Breadcrumbs, LoadFailure } from "@/components/workspace/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SkeletonCard } from "@/components/ui/feedback";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { describeRequestFailure } from "@/lib/errors";
import {
  formatBytes,
  formatDateTime,
  formatRelativeTime,
  pluralize,
} from "@/lib/format";

type LoadState = "loading" | "ready" | "error";

const CONTRACT_HISTORY_LIMIT = 50;

type ContractData = {
  contract: ContractDetailDto;
  project: ProjectDto;
  analyses: AnalysisRunDto[];
};

function ContractDetailBody({ contractId }: { contractId: string }) {
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<ContractData | null>(null);
  const [failure, setFailure] = useState<ReturnType<typeof describeRequestFailure> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const contract = await api.getContract(contractId);
        const [project, history] = await Promise.all([
          api.getProject(contract.projectId),
          api.listComparisons(contract.projectId, { limit: CONTRACT_HISTORY_LIMIT }),
        ]);
        if (!active) {
          return;
        }
        const versionIds = new Set(contract.versions.map((version) => version.id));
        const analyses = history.analyses.filter(
          (analysis) =>
            versionIds.has(analysis.baselineVersionId) ||
            versionIds.has(analysis.candidateVersionId),
        );
        setData({ contract, project, analyses });
        setState("ready");
      } catch (loadError) {
        if (!active) {
          return;
        }
        setFailure(describeRequestFailure(loadError, "Could not load this contract."));
        setState("error");
      }
    })();

    return () => {
      active = false;
    };
  }, [contractId, reloadKey]);

  function retry() {
    setState("loading");
    setFailure(null);
    setReloadKey((current) => current + 1);
  }

  if (state === "loading") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Projects", href: "/projects" }, { label: "Contract" }]} />
        <PageHeader eyebrow="Contract" title="Loading contract…" />
        <p className="sr-only" role="status" aria-live="polite">
          Loading this contract…
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2" aria-hidden="true">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (state === "error" || !data) {
    const notFound = failure?.notFound ?? false;
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
        <Breadcrumbs items={[{ label: "Projects", href: "/projects" }, { label: "Contract" }]} />
        {notFound ? (
          <EmptyState
            title="Contract not found"
            description="This contract does not exist, or it belongs to a different account."
            action={
              <Link href="/projects" className="btn-primary">
                Back to projects
              </Link>
            }
          />
        ) : (
          <LoadFailure
            title="Could not load this contract"
            message={failure?.message ?? "The API did not respond as expected."}
            details={failure?.details}
            onRetry={retry}
          />
        )}
      </div>
    );
  }

  const { contract, project, analyses } = data;
  const workspaceHref = `/contracts?project=${encodeURIComponent(project.id)}&contract=${encodeURIComponent(contract.id)}`;
  const versions = [...contract.versions].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  const latestVersion = versions[0] ?? null;
  const warningCount = contract.versions.reduce(
    (total, version) => total + version.warnings.length,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "Projects", href: "/projects" },
          { label: project.name, href: `/projects/${project.id}` },
          { label: contract.name },
        ]}
      />

      <PageHeader
        eyebrow="Contract"
        title={contract.name}
        description={
          <>
            OpenAPI document in{" "}
            <Link href={`/projects/${project.id}`} className="link">
              {project.name}
            </Link>
            . Versions are immutable; comparisons are saved against the versions you select.
          </>
        }
        actions={
          <>
            <Link href={`/projects/${project.id}`} className="btn-secondary whitespace-nowrap">
              Back to project
            </Link>
            <Link href={workspaceHref} className="btn-primary whitespace-nowrap">
              Open workspace
            </Link>
          </>
        }
        meta={
          <>
            <span>{pluralize(contract.versions.length, "version")}</span>
            <span aria-hidden="true">·</span>
            <span>{pluralize(analyses.length, "related analysis", "related analyses")}</span>
            {warningCount > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{pluralize(warningCount, "parser warning")}</span>
              </>
            ) : null}
          </>
        }
      />

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="card p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Versions</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {contract.versions.length}
          </dd>
          <dd className="mt-1 text-xs text-subtle">Immutable uploads</dd>
        </div>
        <div className="card p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
            Related analyses
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {analyses.length}
          </dd>
          <dd className="mt-1 text-xs text-subtle">Among the latest project runs</dd>
        </div>
        <div className="card col-span-2 p-4 lg:col-span-1">
          <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
            Latest version
          </dt>
          <dd
            className="mt-1 text-lg font-semibold text-foreground"
            title={latestVersion ? formatDateTime(latestVersion.createdAt) : undefined}
          >
            {latestVersion ? formatRelativeTime(latestVersion.createdAt) : "—"}
          </dd>
          <dd className="mt-1 text-xs text-subtle">
            {latestVersion
              ? `${latestVersion.label ?? "Unlabeled"} · ${latestVersion.format.toUpperCase()}`
              : "No versions uploaded"}
          </dd>
        </div>
      </dl>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-8">
          <section aria-labelledby="contract-versions">
            <div className="mb-3">
              <h2 id="contract-versions" className="text-lg font-semibold tracking-tight">
                Versions
              </h2>
              <p className="mt-1 text-xs text-subtle">
                Newest first. Upload another version in the review workspace to compare it.
              </p>
            </div>

            {contract.versions.length === 0 ? (
              <EmptyState
                title="No versions uploaded"
                description="Upload a baseline OpenAPI document in the review workspace to start this contract's version history."
                action={
                  <Link href={workspaceHref} className="btn-primary">
                    Upload a version
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-3">
                {versions.map((version) => (
                  <li key={version.id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-foreground">
                          {version.label ?? "Unlabeled version"}
                        </h3>
                        <p className="mt-1 text-xs text-subtle">
                          {version.title ?? "Untitled document"}
                          {version.infoVersion ? ` · Info version ${version.infoVersion}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="neutral">{version.format.toUpperCase()}</Badge>
                        {version.openapiVersion ? (
                          <Badge tone="outline">OpenAPI {version.openapiVersion}</Badge>
                        ) : null}
                        {version.warnings.length > 0 ? (
                          <Badge tone="warning">
                            {pluralize(version.warnings.length, "warning")}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                      <div>
                        <dt className="text-subtle">Uploaded</dt>
                        <dd
                          className="mt-0.5 text-foreground"
                          title={formatDateTime(version.createdAt)}
                        >
                          {formatRelativeTime(version.createdAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-subtle">Size</dt>
                        <dd className="mt-0.5 text-foreground">{formatBytes(version.contentBytes)}</dd>
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <dt className="text-subtle">Checksum</dt>
                        <dd
                          className="mt-0.5 truncate font-mono text-[11px] text-muted"
                          title={version.checksum}
                        >
                          {version.checksum.slice(0, 16)}…
                        </dd>
                      </div>
                    </dl>

                    {version.warnings.length > 0 ? (
                      <details className="mt-4 rounded-lg border border-warning/25 bg-warning-light p-3 text-xs text-foreground">
                        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-warning">
                          Parser warnings ({version.warnings.length})
                        </summary>
                        <ul className="mt-2 list-disc space-y-1 pl-5">
                          {version.warnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="contract-analyses">
            <div className="mb-3">
              <h2 id="contract-analyses" className="text-lg font-semibold tracking-tight">
                Related analyses
              </h2>
              <p className="mt-1 text-xs text-subtle">
                Saved comparisons whose baseline or candidate is one of this contract&apos;s
                versions. The project history may contain older runs beyond the latest{" "}
                {CONTRACT_HISTORY_LIMIT}.
              </p>
            </div>

            {analyses.length === 0 ? (
              <EmptyState
                title="No related analyses"
                description="Run a comparison that uses one of these versions to see its findings, impact map, and report here."
                action={
                  <Link href={workspaceHref} className="btn-primary">
                    Run a comparison
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-3">
                {analyses.map((analysis) => (
                  <AnalysisRow
                    key={analysis.id}
                    analysis={analysis}
                    href={`/analyses/${analysis.id}`}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-foreground">Add a version</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              The workspace opens with this project and contract selected. Upload JSON or YAML,
              then compare two versions.
            </p>
            <Link href={workspaceHref} className="btn-primary mt-4 w-full">
              Upload in workspace
            </Link>
          </div>

          <div className="card-muted p-5">
            <h2 className="text-sm font-semibold text-foreground">Contract details</h2>
            <dl className="mt-3 space-y-3 text-xs">
              <div>
                <dt className="text-subtle">Project</dt>
                <dd className="mt-0.5">
                  <Link href={`/projects/${project.id}`} className="link">
                    {project.name}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-subtle">Created</dt>
                <dd className="mt-0.5 text-foreground">{formatDateTime(contract.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-subtle">Last updated</dt>
                <dd className="mt-0.5 text-foreground">{formatDateTime(contract.updatedAt)}</dd>
              </div>
              <div>
                <dt className="text-subtle">Contract ID</dt>
                <dd className="mt-0.5 break-all font-mono text-[11px] text-muted">
                  {contract.id}
                </dd>
              </div>
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-foreground">Version content</h2>
            <p className="mt-2 text-xs leading-5 text-muted">
              Uploaded documents are kept server-side and are not rendered here. Findings,
              source evidence, and exports are available from each saved analysis.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function ContractDetail({ contractId }: { contractId: string }) {
  return (
    <AuthGate
      signInTitle="Sign in to view this contract"
      signInDescription={
        <p>Contracts and their version history are private to the account that created them.</p>
      }
    >
      <ContractDetailBody contractId={contractId} />
    </AuthGate>
  );
}
