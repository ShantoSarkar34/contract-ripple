"use client";

import { useEffect, useState } from "react";
import type {
  AnalysisRunDetailDto,
  AnalysisRunDto,
  ContractDto,
  ContractVersionDto,
  ProjectDto,
} from "@contract-ripple/shared";
import { API_BASE_URL, ApiRequestError, api, describeErrorDetails } from "@/lib/api";
import ComparisonResults from "./comparison-results";
import SourceImpactPanel from "./source-impact-panel";

type LoadState = "idle" | "loading" | "ready" | "error";
type SubmitError = { message: string; details: string[] };

function toSubmitError(error: unknown): SubmitError {
  if (error instanceof ApiRequestError) {
    return { message: error.message, details: describeErrorDetails(error) };
  }
  return {
    message: error instanceof Error ? error.message : "An unexpected error occurred.",
    details: [],
  };
}

function ErrorNotice({ error, onRetry }: { error: SubmitError; onRetry?: () => void }) {
  return (
    <div className="rounded-md border border-danger/30 bg-danger-light p-3 text-sm text-danger">
      <p className="font-medium">{error.message}</p>
      {error.details.length > 0 ? (
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {error.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
      {onRetry ? (
        <button type="button" className="mt-2 text-xs font-semibold underline" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export default function ContractsWorkspace() {
  const [readiness, setReadiness] = useState<"checking" | "up" | "down">("checking");

  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [projectsState, setProjectsState] = useState<LoadState>("loading");
  const [projectsError, setProjectsError] = useState<SubmitError | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectError, setProjectError] = useState<SubmitError | null>(null);

  const [contracts, setContracts] = useState<ContractDto[]>([]);
  const [contractsState, setContractsState] = useState<LoadState>("idle");
  const [contractsError, setContractsError] = useState<SubmitError | null>(null);
  const [selectedContractId, setSelectedContractId] = useState("");
  const [newContractName, setNewContractName] = useState("");
  const [creatingContract, setCreatingContract] = useState(false);
  const [contractError, setContractError] = useState<SubmitError | null>(null);

  const [versions, setVersions] = useState<ContractVersionDto[]>([]);
  const [versionsState, setVersionsState] = useState<LoadState>("idle");
  const [versionsError, setVersionsError] = useState<SubmitError | null>(null);
  const [baselineVersionId, setBaselineVersionId] = useState("");
  const [candidateVersionId, setCandidateVersionId] = useState("");

  const [baselineContent, setBaselineContent] = useState("");
  const [baselineLabel, setBaselineLabel] = useState("");
  const [candidateContent, setCandidateContent] = useState("");
  const [candidateLabel, setCandidateLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);

  const [analysis, setAnalysis] = useState<AnalysisRunDetailDto | null>(null);
  const [history, setHistory] = useState<AnalysisRunDto[]>([]);
  const [historyState, setHistoryState] = useState<LoadState>("idle");

  async function reloadProjects(): Promise<void> {
    try {
      const response = await api.listProjects();
      setProjects(response.projects);
      setProjectsState("ready");
      setProjectsError(null);
      setSelectedProjectId((current) =>
        current && response.projects.some((project) => project.id === current)
          ? current
          : (response.projects[0]?.id ?? ""),
      );
    } catch (error) {
      setProjectsError(toSubmitError(error));
      setProjectsState("error");
    }
  }

  async function reloadContracts(projectId: string): Promise<void> {
    try {
      const response = await api.listContracts(projectId);
      setContracts(response.contracts);
      setContractsState("ready");
      setContractsError(null);
      setSelectedContractId((current) =>
        current && response.contracts.some((contract) => contract.id === current)
          ? current
          : (response.contracts[0]?.id ?? ""),
      );
    } catch (error) {
      setContractsError(toSubmitError(error));
      setContractsState("error");
    }
  }

  async function reloadVersions(contractId: string): Promise<void> {
    try {
      const response = await api.listVersions(contractId);
      setVersions(response.versions);
      setVersionsState("ready");
      setVersionsError(null);
      setBaselineVersionId((current) =>
        current && response.versions.some((version) => version.id === current)
          ? current
          : (response.versions[0]?.id ?? ""),
      );
      setCandidateVersionId((current) =>
        current && response.versions.some((version) => version.id === current)
          ? current
          : (response.versions[response.versions.length - 1]?.id ?? ""),
      );
    } catch (error) {
      setVersionsError(toSubmitError(error));
      setVersionsState("error");
    }
  }

  async function reloadHistory(projectId: string): Promise<void> {
    try {
      const response = await api.listComparisons(projectId);
      setHistory(response.analyses);
      setHistoryState("ready");
    } catch {
      setHistoryState("error");
    }
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const ready = await api.getReady();
        if (!cancelled) {
          setReadiness(ready.database === "up" ? "up" : "down");
        }
      } catch {
        if (!cancelled) {
          setReadiness("down");
        }
      }

      try {
        const response = await api.listProjects();
        if (cancelled) {
          return;
        }
        setProjects(response.projects);
        setProjectsState("ready");
        setProjectsError(null);
        setSelectedProjectId((current) =>
          current && response.projects.some((project) => project.id === current)
            ? current
            : (response.projects[0]?.id ?? ""),
        );
      } catch (error) {
        if (cancelled) {
          return;
        }
        setProjectsError(toSubmitError(error));
        setProjectsState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        const response = await api.listContracts(selectedProjectId);
        if (cancelled) {
          return;
        }
        setContracts(response.contracts);
        setContractsState("ready");
        setContractsError(null);
        setSelectedContractId((current) =>
          current && response.contracts.some((contract) => contract.id === current)
            ? current
            : (response.contracts[0]?.id ?? ""),
        );
      } catch (error) {
        if (cancelled) {
          return;
        }
        setContractsError(toSubmitError(error));
        setContractsState("error");
      }

      try {
        const response = await api.listComparisons(selectedProjectId);
        if (cancelled) {
          return;
        }
        setHistory(response.analyses);
        setHistoryState("ready");
      } catch {
        if (!cancelled) {
          setHistoryState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedContractId) {
      return;
    }
    let cancelled = false;

    void (async () => {
      try {
        const response = await api.listVersions(selectedContractId);
        if (cancelled) {
          return;
        }
        setVersions(response.versions);
        setVersionsState("ready");
        setVersionsError(null);
        setBaselineVersionId((current) =>
          current && response.versions.some((version) => version.id === current)
            ? current
            : (response.versions[0]?.id ?? ""),
        );
        setCandidateVersionId((current) =>
          current && response.versions.some((version) => version.id === current)
            ? current
            : (response.versions[response.versions.length - 1]?.id ?? ""),
        );
      } catch (error) {
        if (cancelled) {
          return;
        }
        setVersionsError(toSubmitError(error));
        setVersionsState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedContractId]);

  const selectedContract = contracts.find((contract) => contract.id === selectedContractId) ?? null;

  function handleSelectProject(projectId: string) {
    setSelectedProjectId(projectId);
    setAnalysis(null);
    setSubmitError(null);
    setContractsState("loading");
    setHistoryState("loading");
  }

  function handleSelectContract(contractId: string) {
    setSelectedContractId(contractId);
    setAnalysis(null);
    setSubmitError(null);
    setVersionsState("loading");
  }

  async function handleCreateProject() {
    if (!newProjectName.trim()) {
      setProjectError({ message: "Enter a project name.", details: [] });
      return;
    }
    setCreatingProject(true);
    setProjectError(null);
    setAnalysis(null);
    setContractsState("loading");
    setHistoryState("loading");
    try {
      const project = await api.createProject({ name: newProjectName.trim() });
      setNewProjectName("");
      await reloadProjects();
      setSelectedProjectId(project.id);
    } catch (error) {
      setProjectError(toSubmitError(error));
    } finally {
      setCreatingProject(false);
    }
  }

  async function handleCreateContract() {
    if (!selectedProjectId) {
      setContractError({ message: "Select a project first.", details: [] });
      return;
    }
    if (!newContractName.trim()) {
      setContractError({ message: "Enter a contract name.", details: [] });
      return;
    }
    setCreatingContract(true);
    setContractError(null);
    setAnalysis(null);
    setVersionsState("loading");
    try {
      const contract = await api.createContract(selectedProjectId, {
        name: newContractName.trim(),
      });
      setNewContractName("");
      await reloadContracts(selectedProjectId);
      setSelectedContractId(contract.id);
    } catch (error) {
      setContractError(toSubmitError(error));
    } finally {
      setCreatingContract(false);
    }
  }

  async function handleUploadAndCompare() {
    if (!selectedProjectId || !selectedContractId) {
      setSubmitError({ message: "Select a project and contract first.", details: [] });
      return;
    }
    if (!baselineContent.trim() || !candidateContent.trim()) {
      setSubmitError({
        message: "Paste both the baseline and candidate contract content.",
        details: [],
      });
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setAnalysis(null);
    try {
      const baseline = await api.createContractVersion(selectedContractId, {
        content: baselineContent,
        label: baselineLabel.trim() || undefined,
      });
      const candidate = await api.createContractVersion(selectedContractId, {
        content: candidateContent,
        label: candidateLabel.trim() || undefined,
      });
      const result = await api.createComparison(selectedProjectId, {
        baselineVersionId: baseline.id,
        candidateVersionId: candidate.id,
        label: `${baselineLabel.trim() || "baseline"} → ${candidateLabel.trim() || "candidate"}`,
      });

      setAnalysis(result);
      setBaselineContent("");
      setCandidateContent("");
      setBaselineLabel("");
      setCandidateLabel("");
      await reloadVersions(selectedContractId);
      await reloadHistory(selectedProjectId);
    } catch (error) {
      setSubmitError(toSubmitError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCompareSelected() {
    if (!selectedProjectId || !baselineVersionId || !candidateVersionId) {
      setSubmitError({ message: "Choose both a baseline and a candidate version.", details: [] });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    setAnalysis(null);
    try {
      const result = await api.createComparison(selectedProjectId, {
        baselineVersionId,
        candidateVersionId,
      });
      setAnalysis(result);
      await reloadHistory(selectedProjectId);
    } catch (error) {
      setSubmitError(toSubmitError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOpenAnalysis(runId: string) {
    setSubmitError(null);
    try {
      const detail = await api.getComparison(runId);
      setAnalysis(detail);
    } catch (error) {
      setSubmitError(toSubmitError(error));
    }
  }

  function handleFile(
    event: React.ChangeEvent<HTMLInputElement>,
    setContent: (value: string) => void,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError({ message: "That file exceeds the 5 MiB contract limit.", details: [] });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setContent(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () =>
      setSubmitError({ message: "The selected file could not be read.", details: [] });
    reader.readAsText(file);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <header className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Contract review workspace
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              Create a project, upload baseline and candidate OpenAPI contracts, and review every
              classified difference with its JSON Pointer evidence. Results below come from the real
              comparison engine and are stored in the database.
            </p>
          </div>
          <div className="text-right text-xs">
            <p className="font-medium text-slate-500 dark:text-slate-400">API endpoint</p>
            <code className="text-primary">{API_BASE_URL}</code>
            <p className="mt-1">
              <span
                className={
                  readiness === "up"
                    ? "font-semibold text-success"
                    : readiness === "down"
                      ? "font-semibold text-danger"
                      : "font-semibold text-slate-500 dark:text-slate-400"
                }
              >
                {readiness === "up"
                  ? "Connected"
                  : readiness === "down"
                    ? "Unavailable"
                    : "Checking…"}
              </span>
            </p>
          </div>
        </div>
      </header>

      {readiness === "down" ? (
        <div className="mb-6 rounded-md border border-warning/30 bg-warning-light p-3 text-sm text-warning">
          The API is not reachable. Start the backend with <code>npm run api:dev</code> and confirm{" "}
          <code>NEXT_PUBLIC_API_BASE_URL</code>.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <aside className="space-y-6">
          <section className="card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              1 · Project
            </h2>

            {projectsState === "loading" ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading projects…</p>
            ) : null}

            {projectsState === "error" && projectsError ? (
              <div className="mt-3">
                <ErrorNotice error={projectsError} onRetry={() => void reloadProjects()} />
              </div>
            ) : null}

            {projectsState === "ready" && projects.length > 0 ? (
              <select
                className="input mt-3"
                value={selectedProjectId}
                onChange={(event) => handleSelectProject(event.target.value)}
                aria-label="Select project"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} ({project.contractCount})
                  </option>
                ))}
              </select>
            ) : null}

            {projectsState === "ready" && projects.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                No projects yet. Create the first one below.
              </p>
            ) : null}

            <div className="mt-3 space-y-2">
              <input
                className="input"
                placeholder="New project name"
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleCreateProject();
                  }
                }}
                aria-label="New project name"
              />
              <button
                type="button"
                className="btn-secondary w-full"
                disabled={creatingProject}
                onClick={() => void handleCreateProject()}
              >
                {creatingProject ? "Creating…" : "Create project"}
              </button>
              {projectError ? <ErrorNotice error={projectError} /> : null}
            </div>
          </section>

          <section className="card p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              2 · Contract
            </h2>

            {!selectedProjectId ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Select or create a project to manage contracts.
              </p>
            ) : null}

            {contractsState === "loading" || (contractsState === "idle" && selectedProjectId) ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading contracts…</p>
            ) : null}

            {contractsState === "error" && contractsError ? (
              <div className="mt-3">
                <ErrorNotice
                  error={contractsError}
                  onRetry={() => void reloadContracts(selectedProjectId)}
                />
              </div>
            ) : null}

            {contractsState === "ready" && contracts.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {contracts.map((contract) => (
                  <li key={contract.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectContract(contract.id)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        contract.id === selectedContractId
                          ? "bg-primary-light text-primary"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span className="font-medium">{contract.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {contract.versionCount}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {contractsState === "ready" && contracts.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                No contracts in this project yet.
              </p>
            ) : null}

            {selectedProjectId ? (
              <div className="mt-3 space-y-2">
                <input
                  className="input"
                  placeholder="New contract name"
                  value={newContractName}
                  onChange={(event) => setNewContractName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleCreateContract();
                    }
                  }}
                  aria-label="New contract name"
                />
                <button
                  type="button"
                  className="btn-secondary w-full"
                  disabled={creatingContract}
                  onClick={() => void handleCreateContract()}
                >
                  {creatingContract ? "Creating…" : "Create contract"}
                </button>
                {contractError ? <ErrorNotice error={contractError} /> : null}
              </div>
            ) : null}
          </section>

          {selectedProjectId && history.length > 0 ? (
            <section className="card p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                History
              </h2>
              {historyState === "loading" ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading…</p>
              ) : (
                <ul className="mt-3 space-y-1">
                  {history.map((run) => (
                    <li key={run.id}>
                      <button
                        type="button"
                        onClick={() => void handleOpenAnalysis(run.id)}
                        className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span className="font-medium text-foreground">
                          {run.baselineVersionLabel ?? "baseline"} →{" "}
                          {run.candidateVersionLabel ?? "candidate"}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                          {run.totalFindings} changes · {run.potentiallyBreakingCount} potentially
                          breaking
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </aside>

        <main className="space-y-6">
          {!selectedContract ? (
            <section className="card p-8 text-center">
              <h2 className="text-lg font-semibold text-foreground">Select a contract</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
                Choose a project and contract on the left, or create them, to upload contract
                versions and run a comparison.
              </p>
            </section>
          ) : (
            <>
              <section className="card p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  3 · Versions of {selectedContract.name}
                </h2>

                {versionsState === "loading" || (versionsState === "idle" && selectedContractId) ? (
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    Loading versions…
                  </p>
                ) : null}

                {versionsState === "error" && versionsError ? (
                  <div className="mt-3">
                    <ErrorNotice
                      error={versionsError}
                      onRetry={() => void reloadVersions(selectedContractId)}
                    />
                  </div>
                ) : null}

                {versionsState === "ready" && versions.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    No versions yet. Upload a baseline and a candidate below.
                  </p>
                ) : null}

                {versions.length > 0 ? (
                  <>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {versions.map((version) => (
                        <li
                          key={version.id}
                          className="rounded-md border border-slate-200 px-3 py-2 text-xs dark:border-slate-700"
                        >
                          <span className="font-semibold text-foreground">
                            {version.label ?? version.id.slice(0, 8)}
                          </span>
                          <span className="ml-2 text-slate-500 dark:text-slate-400">
                            {version.format} · {version.openapiVersion ?? "?"} ·{" "}
                            {Math.round(version.contentBytes / 1024)} KB
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                        Baseline version
                        <select
                          className="input mt-1"
                          value={baselineVersionId}
                          onChange={(event) => setBaselineVersionId(event.target.value)}
                        >
                          {versions.map((version) => (
                            <option key={version.id} value={version.id}>
                              {version.label ?? version.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                        Candidate version
                        <select
                          className="input mt-1"
                          value={candidateVersionId}
                          onChange={(event) => setCandidateVersionId(event.target.value)}
                        >
                          {versions.map((version) => (
                            <option key={version.id} value={version.id}>
                              {version.label ?? version.id.slice(0, 8)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={submitting}
                        onClick={() => void handleCompareSelected()}
                      >
                        Compare selected
                      </button>
                    </div>
                  </>
                ) : null}
              </section>

              <section className="card p-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Upload and compare new versions
                </h2>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="baseline-content"
                        className="text-sm font-medium text-foreground"
                      >
                        Baseline (before)
                      </label>
                      <input
                        type="file"
                        accept=".json,.yaml,.yml,application/json,text/yaml"
                        className="text-xs text-slate-500 dark:text-slate-400"
                        onChange={(event) => handleFile(event, setBaselineContent)}
                      />
                    </div>
                    <input
                      className="input"
                      placeholder="Label (optional), e.g. v1.4.0"
                      value={baselineLabel}
                      onChange={(event) => setBaselineLabel(event.target.value)}
                    />
                    <textarea
                      id="baseline-content"
                      className="input h-56 resize-y font-mono text-xs"
                      placeholder="Paste JSON or YAML OpenAPI content…"
                      value={baselineContent}
                      onChange={(event) => setBaselineContent(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="candidate-content"
                        className="text-sm font-medium text-foreground"
                      >
                        Candidate (after)
                      </label>
                      <input
                        type="file"
                        accept=".json,.yaml,.yml,application/json,text/yaml"
                        className="text-xs text-slate-500 dark:text-slate-400"
                        onChange={(event) => handleFile(event, setCandidateContent)}
                      />
                    </div>
                    <input
                      className="input"
                      placeholder="Label (optional), e.g. v1.5.0"
                      value={candidateLabel}
                      onChange={(event) => setCandidateLabel(event.target.value)}
                    />
                    <textarea
                      id="candidate-content"
                      className="input h-56 resize-y font-mono text-xs"
                      placeholder="Paste JSON or YAML OpenAPI content…"
                      value={candidateContent}
                      onChange={(event) => setCandidateContent(event.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={submitting}
                    onClick={() => void handleUploadAndCompare()}
                  >
                    {submitting ? "Analysing…" : "Upload and compare"}
                  </button>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Both contracts are validated before anything is saved.
                  </p>
                </div>

                {submitError ? (
                  <div className="mt-4">
                    <ErrorNotice error={submitError} />
                  </div>
                ) : null}
              </section>

              {analysis ? <ComparisonResults analysis={analysis} /> : null}

              {analysis && selectedProjectId ? (
                <SourceImpactPanel
                  key={`${selectedProjectId}:${analysis.id}`}
                  projectId={selectedProjectId}
                  analysis={analysis}
                />
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
