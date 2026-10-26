"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type {
  AnalysisRunDto,
  ContractDto,
  ListAnalysesResponse,
  ProjectDto,
} from "@contract-ripple/shared";
import { AuthGate } from "@/components/workspace/auth-gate";
import { AnalysisRow } from "@/components/workspace/analysis-row";
import { Breadcrumbs, LoadFailure } from "@/components/workspace/breadcrumbs";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, SkeletonCard } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { describeRequestFailure } from "@/lib/errors";
import { formatDateTime, formatRelativeTime, pluralize } from "@/lib/format";

type LoadState = "loading" | "ready" | "error";

const PROJECT_HISTORY_LIMIT = 10;

type ProjectData = {
  project: ProjectDto;
  contracts: ContractDto[];
  history: ListAnalysesResponse | null;
  historyError: string | null;
};

function CreateContractDialog({
  projectId,
  open,
  onClose,
  onCreated,
}: {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (contract: ContractDto) => void;
}) {
  const formId = useId();
  const nameId = useId();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  function handleClose() {
    if (submitting) {
      return;
    }
    setName("");
    setError(null);
    setNameError(null);
    onClose();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Enter a contract name.");
      window.requestAnimationFrame(() => document.getElementById(nameId)?.focus());
      return;
    }

    setSubmitting(true);
    setError(null);
    setNameError(null);
    try {
      const contract = await api.createContract(projectId, { name: trimmedName });
      onCreated(contract);
    } catch (createError) {
      setError(describeRequestFailure(createError, "Could not create the contract.").message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="New contract"
      description="A contract groups the versions of one OpenAPI document. Add its first version in the review workspace."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" form={formId} className="btn-primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create contract"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <Alert tone="danger" title="Could not create the contract">
            {error}
          </Alert>
        ) : null}

        <Field
          id={nameId}
          label="Contract name"
          required
          hint="Up to 200 characters."
          error={nameError ?? undefined}
        >
          <Input
            id={nameId}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (nameError) {
                setNameError(null);
              }
            }}
            maxLength={200}
            autoComplete="off"
            required
            placeholder="Payments API"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${nameId}-error` : `${nameId}-hint`}
          />
        </Field>
      </form>
    </Dialog>
  );
}

function ProjectSkeleton() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="card p-4">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-3 h-7 w-10" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

function ProjectDetailBody({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<ProjectData | null>(null);
  const [failure, setFailure] = useState<ReturnType<typeof describeRequestFailure> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const [project, contractResponse] = await Promise.all([
          api.getProject(projectId),
          api.listContracts(projectId),
        ]);
        let history: ListAnalysesResponse | null = null;
        let historyError: string | null = null;
        try {
          history = await api.listComparisons(projectId, { limit: PROJECT_HISTORY_LIMIT });
        } catch (loadError) {
          historyError = describeRequestFailure(
            loadError,
            "Could not load this project's saved analyses.",
          ).message;
        }

        if (!active) {
          return;
        }
        setData({ project, contracts: contractResponse.contracts, history, historyError });
        setState("ready");
      } catch (loadError) {
        if (!active) {
          return;
        }
        setFailure(describeRequestFailure(loadError, "Could not load this project."));
        setState("error");
      }
    })();

    return () => {
      active = false;
    };
  }, [projectId, reloadKey]);

  function retry() {
    setState("loading");
    setFailure(null);
    setReloadKey((current) => current + 1);
  }

  function handleContractCreated(contract: ContractDto) {
    setCreateOpen(false);
    setData((current) =>
      current
        ? {
            ...current,
            project: { ...current.project, contractCount: current.project.contractCount + 1 },
            contracts: [contract, ...current.contracts],
          }
        : current,
    );
    router.push(
      `/contracts?project=${encodeURIComponent(projectId)}&contract=${encodeURIComponent(contract.id)}`,
    );
  }

  if (state === "loading") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Projects", href: "/projects" }, { label: "Project" }]} />
        <PageHeader eyebrow="Project" title="Loading project…" />
        <p className="sr-only" role="status" aria-live="polite">
          Loading this project…
        </p>
        <div className="mt-6">
          <ProjectSkeleton />
        </div>
      </div>
    );
  }

  if (state === "error" || !data) {
    const notFound = failure?.notFound ?? false;
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6">
        <Breadcrumbs items={[{ label: "Projects", href: "/projects" }, { label: "Project" }]} />
        {notFound ? (
          <EmptyState
            title="Project not found"
            description="This project does not exist, or it belongs to a different account."
            action={
              <Link href="/projects" className="btn-primary">
                Back to projects
              </Link>
            }
          />
        ) : (
          <LoadFailure
            title="Could not load this project"
            message={failure?.message ?? "The API did not respond as expected."}
            details={failure?.details}
            onRetry={retry}
          />
        )}
      </div>
    );
  }

  const { project, contracts, history, historyError } = data;
  const workspaceHref = `/contracts?project=${encodeURIComponent(project.id)}`;
  const shownAnalyses: AnalysisRunDto[] = history?.analyses ?? [];
  const totalAnalyses = history?.totalCount ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8">
      <Breadcrumbs
        items={[
          { label: "Projects", href: "/projects" },
          { label: project.name },
        ]}
      />

      <PageHeader
        eyebrow="Project"
        title={project.name}
        description={project.description ?? "No description has been added to this project."}
        actions={
          <>
            <Link href={workspaceHref} className="btn-secondary whitespace-nowrap">
              Open workspace
            </Link>
            <button
              type="button"
              className="btn-primary whitespace-nowrap"
              onClick={() => setCreateOpen(true)}
            >
              New contract
            </button>
          </>
        }
        meta={
          <>
            <span>{pluralize(contracts.length, "contract")}</span>
            <span aria-hidden="true">·</span>
            <span>
              {history
                ? pluralize(totalAnalyses, "saved analysis", "saved analyses")
                : "History unavailable"}
            </span>
            <span aria-hidden="true">·</span>
            <span title={formatDateTime(project.createdAt)}>
              Created {formatRelativeTime(project.createdAt)}
            </span>
          </>
        }
      />

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <div className="card p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-subtle">Contracts</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {contracts.length}
          </dd>
          <dd className="mt-1 text-xs text-subtle">Documents in this project</dd>
        </div>
        <div className="card p-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
            Saved analyses
          </dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {history ? totalAnalyses : "—"}
          </dd>
          <dd className="mt-1 text-xs text-subtle">
            {historyError ? "History could not be loaded" : "Persisted comparisons"}
          </dd>
        </div>
        <div className="card col-span-2 p-4 lg:col-span-1">
          <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
            Last updated
          </dt>
          <dd
            className="mt-1 text-lg font-semibold text-foreground"
            title={formatDateTime(project.updatedAt)}
          >
            {formatRelativeTime(project.updatedAt)}
          </dd>
          <dd className="mt-1 text-xs text-subtle">{formatDateTime(project.updatedAt)}</dd>
        </div>
      </dl>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-8">
          <section aria-labelledby="project-contracts">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 id="project-contracts" className="text-lg font-semibold tracking-tight">
                  Contracts
                </h2>
                <p className="mt-1 text-xs text-subtle">
                  Each contract holds one document&apos;s version history.
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost min-h-11 px-3 text-xs"
                onClick={() => setCreateOpen(true)}
              >
                Add contract
              </button>
            </div>

            {contracts.length === 0 ? (
              <EmptyState
                title="No contracts yet"
                description="Create a contract, then upload a baseline and candidate OpenAPI version in the review workspace."
                action={
                  <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
                    Create a contract
                  </button>
                }
              />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {contracts.map((contract) => (
                  <li key={contract.id} className="card flex flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">
                        <Link
                          href={`/contracts/${contract.id}`}
                          className="transition-colors hover:text-primary"
                        >
                          {contract.name}
                        </Link>
                      </h3>
                      <Badge tone="outline" className="shrink-0">
                        {pluralize(contract.versionCount, "version")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-subtle">
                      Updated{" "}
                      <span title={formatDateTime(contract.updatedAt)}>
                        {formatRelativeTime(contract.updatedAt)}
                      </span>
                    </p>
                    <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-3 sm:pt-4">
                      <Link
                        href={`/contracts/${contract.id}`}
                        className="btn-secondary min-h-11 flex-1 px-3 text-xs"
                      >
                        View versions
                      </Link>
                      <Link
                        href={`${workspaceHref}&contract=${encodeURIComponent(contract.id)}`}
                        className="btn-ghost min-h-11 px-3 text-xs"
                      >
                        Upload
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="project-analyses">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 id="project-analyses" className="text-lg font-semibold tracking-tight">
                  Saved analyses
                </h2>
                <p className="mt-1 text-xs text-subtle">
                  Read-only snapshots of contract comparisons run in this project.
                </p>
              </div>
              {totalAnalyses > 0 ? (
                <Link
                  href={`/history?project=${encodeURIComponent(project.id)}`}
                  className="text-xs font-semibold text-primary hover:text-primary-hover"
                >
                  View all {totalAnalyses}
                </Link>
              ) : null}
            </div>

            {historyError ? (
              <Alert tone="warning" title="Saved analyses could not be loaded">
                <p>{historyError}</p>
                <button type="button" className="btn-secondary mt-3" onClick={retry}>
                  Retry
                </button>
              </Alert>
            ) : shownAnalyses.length === 0 ? (
              <EmptyState
                title="No saved analyses yet"
                description="Upload two versions and run a comparison in the review workspace to create the first saved analysis."
                action={
                  <Link href={workspaceHref} className="btn-primary">
                    Open review workspace
                  </Link>
                }
              />
            ) : (
              <>
                <ul className="space-y-3">
                  {shownAnalyses.map((analysis) => (
                    <AnalysisRow
                      key={analysis.id}
                      analysis={analysis}
                      href={`/analyses/${analysis.id}`}
                    />
                  ))}
                </ul>
                {totalAnalyses > shownAnalyses.length ? (
                  <p className="mt-3 text-xs text-subtle">
                    Showing the latest {shownAnalyses.length} of {totalAnalyses} analyses.{" "}
                    <Link
                      href={`/history?project=${encodeURIComponent(project.id)}`}
                      className="font-semibold text-primary hover:text-primary-hover"
                    >
                      Open full history
                    </Link>
                  </p>
                ) : null}
              </>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-foreground">Continue reviewing</h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Upload versions, run a comparison, and analyze frontend source impact in the
              workspace. Every saved run appears on this page.
            </p>
            <div className="mt-4 space-y-2">
              <Link href={workspaceHref} className="btn-primary w-full">
                Open review workspace
              </Link>
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={() => setCreateOpen(true)}
              >
                Add contract
              </button>
            </div>
          </div>

          <div className="card-muted p-5">
            <h2 className="text-sm font-semibold text-foreground">Project details</h2>
            <dl className="mt-3 space-y-3 text-xs">
              <div>
                <dt className="text-subtle">Created</dt>
                <dd className="mt-0.5 text-foreground">{formatDateTime(project.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-subtle">Last updated</dt>
                <dd className="mt-0.5 text-foreground">{formatDateTime(project.updatedAt)}</dd>
              </div>
              <div>
                <dt className="text-subtle">Project ID</dt>
                <dd className="mt-0.5 break-all font-mono text-[11px] text-muted">{project.id}</dd>
              </div>
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-foreground">How analyses work</h2>
            <p className="mt-2 text-xs leading-5 text-muted">
              A saved analysis is an immutable comparison snapshot: findings, limitations, and
              regression checks are read from that run. Source impact is attached only when you
              analyze a ZIP archive or GitHub repository for it.
            </p>
          </div>
        </aside>
      </div>

      <CreateContractDialog
        projectId={project.id}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleContractCreated}
      />
    </div>
  );
}

export default function ProjectDetail({ projectId }: { projectId: string }) {
  return (
    <AuthGate
      signInTitle="Sign in to view this project"
      signInDescription={
        <p>Projects and their saved analyses are private to the account that created them.</p>
      }
    >
      <ProjectDetailBody projectId={projectId} />
    </AuthGate>
  );
}
