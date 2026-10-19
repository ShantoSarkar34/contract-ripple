import type {
  AnalysisRunDetailRecord,
  AnalysisRunRecord,
  AnalysisRunWithVersions,
  ContractRecord,
  ContractRecordWithCount,
  ContractVersionRecord,
  ContractVersionWithContract,
  CreateAnalysisRunInput,
  CreateContractInput,
  CreateContractVersionInput,
  CreateProjectInput,
  FindingRecord,
  ProjectRecord,
  ProjectRecordWithCount,
  Repository,
  UpdateProjectInput,
} from "./types.js";

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * In-memory repository used by unit and route tests. It mirrors the behaviour
 * the Prisma implementation relies on (cascade delete is simulated for
 * `deleteProject`, which the tests use for cleanup).
 */
export class MemoryRepository implements Repository {
  private counter = 0;
  private readonly projects = new Map<string, ProjectRecord>();
  private readonly contracts = new Map<string, ContractRecord>();
  private readonly versions = new Map<string, ContractVersionRecord>();
  private readonly analysisRuns = new Map<string, AnalysisRunRecord>();
  private readonly findings = new Map<string, FindingRecord>();

  private nextId(prefix: string): string {
    this.counter += 1;
    return `${prefix}_${this.counter}`;
  }

  async ping(): Promise<void> {
    return Promise.resolve();
  }

  async createProject(input: CreateProjectInput): Promise<ProjectRecord> {
    const now = new Date();
    const record: ProjectRecord = {
      id: this.nextId("proj"),
      name: input.name,
      description: input.description ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.projects.set(record.id, record);
    return clone(record);
  }

  async listProjects(): Promise<ProjectRecordWithCount[]> {
    return [...this.projects.values()].map((project) => ({
      ...clone(project),
      contractCount: [...this.contracts.values()].filter(
        (contract) => contract.projectId === project.id,
      ).length,
    }));
  }

  async getProject(id: string): Promise<ProjectRecordWithCount | null> {
    const project = this.projects.get(id);
    if (!project) {
      return null;
    }
    return {
      ...clone(project),
      contractCount: [...this.contracts.values()].filter(
        (contract) => contract.projectId === id,
      ).length,
    };
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<ProjectRecord | null> {
    const project = this.projects.get(id);
    if (!project) {
      return null;
    }
    const updated: ProjectRecord = {
      ...project,
      name: input.name ?? project.name,
      description: input.description === undefined ? project.description : input.description,
      updatedAt: new Date(),
    };
    this.projects.set(id, updated);
    return clone(updated);
  }

  async createContract(input: CreateContractInput): Promise<ContractRecord> {
    const now = new Date();
    const record: ContractRecord = {
      id: this.nextId("contract"),
      projectId: input.projectId,
      name: input.name,
      createdAt: now,
      updatedAt: now,
    };
    this.contracts.set(record.id, record);
    return clone(record);
  }

  async listContractsByProject(projectId: string): Promise<ContractRecordWithCount[]> {
    return [...this.contracts.values()]
      .filter((contract) => contract.projectId === projectId)
      .map((contract) => ({
        ...clone(contract),
        versionCount: [...this.versions.values()].filter(
          (version) => version.contractId === contract.id,
        ).length,
      }));
  }

  async getContract(id: string): Promise<ContractRecordWithCount | null> {
    const contract = this.contracts.get(id);
    if (!contract) {
      return null;
    }
    return {
      ...clone(contract),
      versionCount: [...this.versions.values()].filter(
        (version) => version.contractId === id,
      ).length,
    };
  }

  async createContractVersion(
    input: CreateContractVersionInput,
  ): Promise<ContractVersionRecord> {
    const record: ContractVersionRecord = {
      id: this.nextId("version"),
      contractId: input.contractId,
      label: input.label ?? null,
      format: input.format,
      rawContent: input.rawContent,
      checksum: input.checksum,
      openapiVersion: input.openapiVersion ?? null,
      title: input.title ?? null,
      infoVersion: input.infoVersion ?? null,
      warnings: [...input.warnings],
      createdAt: new Date(),
    };
    this.versions.set(record.id, record);
    return clone(record);
  }

  async getContractVersion(id: string): Promise<ContractVersionWithContract | null> {
    const version = this.versions.get(id);
    if (!version) {
      return null;
    }
    const contract = this.contracts.get(version.contractId);
    if (!contract) {
      return null;
    }
    return { ...clone(version), contract: clone(contract) };
  }

  async listVersionsByContract(contractId: string): Promise<ContractVersionRecord[]> {
    return [...this.versions.values()]
      .filter((version) => version.contractId === contractId)
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
      .map(clone);
  }

  async createAnalysisRun(input: CreateAnalysisRunInput): Promise<AnalysisRunRecord> {
    const record: AnalysisRunRecord = {
      id: this.nextId("run"),
      projectId: input.projectId,
      baselineVersionId: input.baselineVersionId,
      candidateVersionId: input.candidateVersionId,
      label: input.label ?? null,
      status: "completed",
      truncated: input.truncated,
      totalFindings: input.totalFindings,
      nonBreakingCount: input.nonBreakingCount,
      potentiallyBreakingCount: input.potentiallyBreakingCount,
      unknownCount: input.unknownCount,
      durationMs: input.durationMs,
      limitations: [...input.limitations],
      baselineSummary: clone(input.baselineSummary),
      candidateSummary: clone(input.candidateSummary),
      createdAt: new Date(),
    };
    this.analysisRuns.set(record.id, record);

    input.findings.forEach((finding, position) => {
      const id = this.nextId("finding");
      this.findings.set(id, {
        id,
        analysisRunId: record.id,
        position,
        engineId: finding.engineId,
        category: finding.category,
        changeType: finding.changeType,
        risk: finding.risk,
        path: finding.path ?? null,
        method: finding.method ?? null,
        operationId: finding.operationId ?? null,
        location: finding.location,
        summary: finding.summary,
        explanation: finding.explanation,
        before: finding.before ?? null,
        after: finding.after ?? null,
        createdAt: new Date(),
      });
    });

    return clone(record);
  }

  async getAnalysisRun(id: string): Promise<AnalysisRunDetailRecord | null> {
    const run = this.analysisRuns.get(id);
    if (!run) {
      return null;
    }
    const baselineVersion = this.versions.get(run.baselineVersionId);
    const candidateVersion = this.versions.get(run.candidateVersionId);
    const baselineContract = baselineVersion
      ? this.contracts.get(baselineVersion.contractId)
      : undefined;
    const candidateContract = candidateVersion
      ? this.contracts.get(candidateVersion.contractId)
      : undefined;
    if (!baselineVersion || !candidateVersion || !baselineContract || !candidateContract) {
      return null;
    }
    return {
      ...clone(run),
      baselineVersion: { ...clone(baselineVersion), contract: clone(baselineContract) },
      candidateVersion: { ...clone(candidateVersion), contract: clone(candidateContract) },
      findings: [...this.findings.values()]
        .filter((finding) => finding.analysisRunId === id)
        .sort((left, right) => left.position - right.position)
        .map(clone),
    };
  }

  async listAnalysisRunsByProject(projectId: string): Promise<AnalysisRunWithVersions[]> {
    return [...this.analysisRuns.values()]
      .filter((run) => run.projectId === projectId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map((run) => {
        const baselineVersion = this.versions.get(run.baselineVersionId);
        const candidateVersion = this.versions.get(run.candidateVersionId);
        if (!baselineVersion || !candidateVersion) {
          throw new Error("Analysis run references a missing contract version.");
        }
        return {
          ...clone(run),
          baselineVersion: clone(baselineVersion),
          candidateVersion: clone(candidateVersion),
        };
      });
  }
}
