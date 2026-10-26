"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { ProjectDto } from "@contract-ripple/shared";
import { AuthGate } from "@/components/workspace/auth-gate";
import { Breadcrumbs, LoadFailure } from "@/components/workspace/breadcrumbs";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, SkeletonCard } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { api } from "@/lib/api";
import { describeRequestFailure } from "@/lib/errors";
import { formatDateTime, formatRelativeTime, pluralize } from "@/lib/format";

type LoadState = "loading" | "ready" | "error";

function messageFor(error: unknown): string {
  return describeRequestFailure(error, "Could not load your projects.").message;
}

function CreateProjectDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (project: ProjectDto) => void;
}) {
  const formId = useId();
  const nameId = useId();
  const descriptionId = useId();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  function handleClose() {
    if (submitting) {
      return;
    }
    setName("");
    setDescription("");
    setError(null);
    setNameError(null);
    onClose();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("Enter a project name.");
      window.requestAnimationFrame(() => document.getElementById(nameId)?.focus());
      return;
    }

    setSubmitting(true);
    setError(null);
    setNameError(null);
    try {
      const project = await api.createProject({
        name: trimmedName,
        description: description.trim() || undefined,
      });
      onCreated(project);
    } catch (createError) {
      setError(messageFor(createError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="New project"
      description="Projects group related OpenAPI contracts, versions, and saved analyses."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" form={formId} className="btn-primary" disabled={submitting}>
            {submitting ? "Creating…" : "Create project"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <Alert tone="danger" title="Could not create the project">
            {error}
          </Alert>
        ) : null}

        <Field
          id={nameId}
          label="Project name"
          required
          hint="Up to 120 characters."
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
            maxLength={120}
            autoComplete="off"
            required
            placeholder="Payments API"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${nameId}-error` : `${nameId}-hint`}
          />
        </Field>

        <Field
          id={descriptionId}
          label="Description"
          hint="Optional. Explain what this project covers."
        >
          <Textarea
            id={descriptionId}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={2000}
            placeholder="Customer-facing payments surface and its integration contracts."
            aria-describedby={`${descriptionId}-hint`}
          />
        </Field>
      </form>
    </Dialog>
  );
}

function ProjectsBody() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let active = true;

    api
      .listProjects()
      .then((response) => {
        if (!active) {
          return;
        }
        setProjects(response.projects);
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

  function handleCreated(project: ProjectDto) {
    setCreateOpen(false);
    setProjects((current) => [project, ...current]);
    router.push(`/projects/${project.id}`);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const visibleProjects = normalizedQuery
    ? projects.filter((project) =>
        [project.name, project.description ?? ""].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        ),
      )
    : projects;
  const contractCount = projects.reduce((total, project) => total + project.contractCount, 0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 lg:px-8">
      <Breadcrumbs items={[{ label: "Workspace", href: "/dashboard" }, { label: "Projects" }]} />

      <PageHeader
        eyebrow="Workspace"
        title="Projects"
        description="Group OpenAPI contracts, track their versions, and review the analyses saved against them."
        actions={
          <>
            <Link href="/contracts" className="btn-secondary whitespace-nowrap">
              Review workspace
            </Link>
            <button
              type="button"
              className="btn-primary whitespace-nowrap"
              onClick={() => setCreateOpen(true)}
            >
              New project
            </button>
          </>
        }
        meta={
          state === "ready" ? (
            <>
              <span>{pluralize(projects.length, "project")}</span>
              <span aria-hidden="true">·</span>
              <span>{pluralize(contractCount, "contract")}</span>
            </>
          ) : undefined
        }
      />

      <div className="mt-6">
        {state === "loading" ? (
          <>
            <p className="sr-only" role="status" aria-live="polite">
              Loading your projects…
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          </>
        ) : null}

        {state === "error" ? (
          <LoadFailure
            title="Could not load your projects"
            message={error ?? "The API did not respond as expected."}
            onRetry={retry}
          />
        ) : null}

        {state === "ready" ? (
          projects.length === 0 ? (
            <EmptyState
              title="No projects yet"
              description="Create a project to group related API contracts. You can add contracts and upload versions here or in the review workspace."
              action={
                <>
                  <button type="button" className="btn-primary" onClick={() => setCreateOpen(true)}>
                    Create your first project
                  </button>
                  <Link href="/contracts" className="btn-secondary">
                    Open review workspace
                  </Link>
                </>
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <label htmlFor="project-search" className="sr-only">
                  Search projects
                </label>
                <Input
                  id="project-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search projects…"
                  className="sm:max-w-xs"
                />
                <p className="text-xs text-subtle" role="status" aria-live="polite">
                  {normalizedQuery
                    ? `${visibleProjects.length} of ${projects.length} projects`
                    : `${pluralize(projects.length, "project")}`}
                </p>
              </div>

              {visibleProjects.length > 0 ? (
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleProjects.map((project) => (
                    <li key={project.id} className="card flex flex-col p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="truncate text-sm font-semibold text-foreground">
                            <Link
                              href={`/projects/${project.id}`}
                              className="transition-colors hover:text-primary"
                            >
                              {project.name}
                            </Link>
                          </h2>
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
                          <dt className="text-subtle">Created</dt>
                          <dd
                            className="mt-0.5 font-medium text-foreground"
                            title={formatDateTime(project.createdAt)}
                          >
                            {formatRelativeTime(project.createdAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-subtle">Updated</dt>
                          <dd
                            className="mt-0.5 font-medium text-foreground"
                            title={formatDateTime(project.updatedAt)}
                          >
                            {formatRelativeTime(project.updatedAt)}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-auto flex flex-wrap gap-2 border-t border-line pt-3 sm:pt-4">
                        <Link
                          href={`/projects/${project.id}`}
                          className="btn-secondary min-h-11 flex-1 px-3 text-xs"
                        >
                          Open project
                        </Link>
                        <Link
                          href={`/contracts?project=${encodeURIComponent(project.id)}`}
                          className="btn-ghost min-h-11 px-3 text-xs"
                        >
                          Workspace
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="No projects match your search"
                  description="Try a different name or description."
                  action={
                    <button type="button" className="btn-secondary" onClick={() => setQuery("")}>
                      Clear search
                    </button>
                  }
                />
              )}
            </div>
          )
        ) : null}
      </div>

      <CreateProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}

export default function ProjectsView() {
  return (
    <AuthGate
      signInTitle="Sign in to view your projects"
      signInDescription={
        <p>
          Projects, contracts, and saved analyses are private to the account that created them.
        </p>
      }
    >
      <ProjectsBody />
    </AuthGate>
  );
}
